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
    /// Transcript path → the working directory read out of its head. Only successful reads are
    /// remembered: a file caught mid-first-record must be asked again on the next sweep, or caching
    /// the "no" hides that Session for the rest of the process's life.
    private var origins: [String: String] = [:]

    public init(store: TranscriptRecordStore = .claudeCode) {
        self.store = store
        self.cli = store.cli
    }

    /// The transcripts to tail for one Project, newest first. A transcript whose working directory
    /// cannot be read belongs to no Project here (degrade-down).
    public func workingSet(for projectURL: URL) -> [URL] {
        let oldest = Date().addingTimeInterval(-Self.workingSetWindow)
        return store.transcripts()
            .filter { $0.modifiedAt >= oldest }
            .sorted { $0.modifiedAt > $1.modifiedAt }
            .map(\.url)
            .filter { belongs($0, to: projectURL) }
    }

    /// One element per burst of writes under the record directory, so a Session started while Argo
    /// is running joins the roster without a relaunch.
    nonisolated func changes() -> AsyncStream<Void> {
        RecordDirectoryWatcher(rootURL: store.rootURL).changes()
    }

    private func belongs(_ transcriptURL: URL, to projectURL: URL) -> Bool {
        guard let cwd = origin(of: transcriptURL) else { return false }
        return ProjectScope.contains(cwd: cwd, projectURL: projectURL)
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
