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
    public static let workingSetWindow: TimeInterval = 24 * 60 * 60

    /// Which CLI the swept records belong to. `nonisolated` so the Hub can read it synchronously
    /// while publishing the roster.
    nonisolated let cli: AgentCLI

    private let store: TranscriptRecordStore
    /// How the file system spells a folder. One of the two seams that mint the key attribution is
    /// decided on (#363) — see `ProjectScope.contains`.
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

    /// The transcripts to tail for one Project, newest first. A transcript whose working directory
    /// cannot be read belongs to no Project here (degrade-down).
    ///
    /// Every folder the answer turns on is spelled in ONE batch, off the main actor: the Project's
    /// own root and the `cwd` of each transcript that survived the mtime window. Both sides of the
    /// comparison have to be spelled the same way or a Project registered through a symlink holds
    /// none of its own Sessions (#363).
    public func workingSet(for projectURL: URL) async -> [URL] {
        let oldest = Date().addingTimeInterval(-Self.workingSetWindow)
        let recent = store.transcripts()
            .filter { $0.modifiedAt >= oldest }
            .sorted { $0.modifiedAt > $1.modifiedAt }
            .map(\.url)
        let spelled = await paths([projectURL.path] + recent.compactMap { origin(of: $0) })
        let root = spelled[projectURL.path] ?? projectURL.path
        return recent.filter { belongs($0, toRoot: root, spelled: spelled) }
    }

    /// One element per burst of writes under the record directory, so a Session started while Argo
    /// is running joins the roster without a relaunch.
    nonisolated func changes() -> AsyncStream<Void> {
        RecordDirectoryWatcher(rootURL: store.rootURL).changes()
    }

    /// A folder the batch could not spell is compared as WRITTEN rather than dropped: a resolve is
    /// I/O and fails for a working directory that has since been deleted, and an equal string is
    /// still the same folder (#363).
    private func belongs(
        _ transcriptURL: URL,
        toRoot root: String,
        spelled: [String: String],
    )
        -> Bool {
        guard let cwd = origin(of: transcriptURL) else { return false }
        return ProjectScope.contains(cwd: spelled[cwd] ?? cwd, projectRoot: root)
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
