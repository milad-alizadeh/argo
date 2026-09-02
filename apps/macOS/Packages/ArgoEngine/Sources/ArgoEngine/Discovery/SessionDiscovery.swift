import Foundation

/// Finds a Project's Sessions in a CLI's on-disk record, so nothing has to be handed a transcript
/// path.
///
/// Two filters, in cost order. The mtime window decides what is opened AT ALL; what survives it is
/// opened head-only, to read the `cwd` that says which Project it belongs to. What survives BOTH is
/// read in full and tailed.
///
/// An actor: the sweep re-runs on every burst of writes under the record directory — roughly once a
/// second while an agent is working — so it must not run on the main actor, and a `cwd` is written
/// once and never changes, so each head is read once per file.
public actor SessionDiscovery {
    /// Running + recently active. A Session quiet for longer than this is history: still on disk to
    /// be opened deliberately, but not what the cockpit is watching.
    ///
    /// A WEEK, and it was a day until #1000. A day is where the reader had left off yesterday, and
    /// on the machine this was measured on it was three transcripts against the hundreds the week
    /// actually held — a roster that answered "where is the rest of my work" with almost none of
    /// it. What made a day the number was cost, not meaning: ADR-0008 kept the window small so the
    /// launch would never read the full history. That constraint now belongs to the BOUNDED read
    /// every sweep takes (`TranscriptExcerpt`) and to the gate on it, so the window is free to be
    /// the span the reader actually works in.
    public static let workingSetWindow: TimeInterval = 7 * 24 * 60 * 60

    /// Which CLI the swept records belong to. `nonisolated` so the Hub can read it synchronously
    /// while publishing the roster.
    nonisolated let cli: AgentCLI

    private let store: TranscriptRecordStore
    /// How the file system spells a folder — one of the two batches that mint a `SpelledPath`.
    private let paths: PathResolutionRead
    /// Transcript path → the working directory read out of its head. Only successful reads are
    /// remembered: a file caught mid-first-record must be asked again on the next sweep, or caching
    /// the "no" hides that Session for the rest of the process's life.
    private var origins: [String: String] = [:]

    public init(
        store: TranscriptRecordStore = .claudeCode,
        paths: @escaping PathResolutionRead = realpathResolutionRead,
    ) {
        self.store = store
        self.paths = paths
        self.cli = store.cli
    }

    /// The transcripts to tail for one Project, newest first.
    ///
    /// Every folder the answer turns on is spelled in ONE batch, off the main actor: the Project's
    /// own root and the `cwd` of each transcript that survived the mtime window.
    public func workingSet(for projectURL: URL) async -> [URL] {
        let oldest = Date().addingTimeInterval(-Self.workingSetWindow)
        let recent = store.transcripts()
            .filter { $0.modifiedAt >= oldest }
            .sorted { $0.modifiedAt > $1.modifiedAt }
            .map(\.url)
        let spelled = await paths([projectURL.path] + recent.compactMap { origin(of: $0) })
        let project = address(of: projectURL, spelled: spelled)
        return recent.filter { belongs($0, to: project, spelled: spelled) }
    }

    /// How this Project is addressed while sweeping: the spelling every `cwd` is compared against,
    /// and the names the CLI would have written its record directory under.
    ///
    /// BOTH spellings are encoded, because the two can disagree and the CLI used neither on Argo's
    /// account: it wrote the path it was launched with, which may be the one Argo resolved away.
    private func address(of projectURL: URL, spelled: [String: String]) -> ProjectAddress {
        let root = spelled.spelling(of: projectURL.path)
        return ProjectAddress(
            root: root,
            recordDirectoryNames: Set([projectURL.path, root.value]
                .compactMap { cli.recordDirectoryName(forProjectRoot: $0) }),
        )
    }

    /// One element per burst of writes under the record directory, so a Session started while Argo
    /// is running joins the roster without a relaunch.
    nonisolated func changes() -> AsyncStream<Void> {
        RecordDirectoryWatcher(rootURL: store.rootURL).changes()
    }

    /// A transcript whose `cwd` reads is placed by it, and nothing else — the file's own word about
    /// where it ran outranks where it was filed.
    ///
    /// A transcript whose `cwd` does NOT read is placed by the directory the CLI filed it in. That
    /// is the §8 degrade: an unparseable head costs the Session its derived facts, never its row,
    /// and dropping the row is the one rendering that cannot be told apart from no Session at all.
    /// It only ever admits — a file whose head reads is never reached by it — so the worst it can
    /// do is put a row on the roster of a Project encoding to the same name.
    private func belongs(
        _ transcriptURL: URL,
        to project: ProjectAddress,
        spelled: [String: String],
    )
        -> Bool {
        guard let cwd = origin(of: transcriptURL) else {
            return project.recordDirectoryNames
                .contains(transcriptURL.deletingLastPathComponent().lastPathComponent)
        }
        return ProjectScope.contains(cwd: spelled.spelling(of: cwd), projectRoot: project.root)
    }

    private func origin(of transcriptURL: URL) -> String? {
        if let remembered = origins[transcriptURL.path] {
            return remembered
        }
        guard let cwd = TranscriptOrigin.cwd(of: transcriptURL) else { return nil }
        origins[transcriptURL.path] = cwd
        return cwd
    }
}
