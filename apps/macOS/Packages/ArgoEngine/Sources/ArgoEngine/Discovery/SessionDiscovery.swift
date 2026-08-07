import Foundation

/// Finds a Project's Sessions in a CLI's on-disk record, so nothing has to be handed a transcript
/// path.
///
/// Two filters, in cost order. The mtime window decides what is opened AT ALL — a Project can hold
/// thousands of historical transcripts, and surveying them must not read them. Only what survives
/// the window is opened, and then only its head, to read the `cwd` that says which Project it
/// belongs to. What survives BOTH filters is read in full and tailed, which is what the window is
/// really bounding: not the survey, but the working set the survey hands to the Hub.
///
/// An actor, for two reasons that are the same reason. The sweep re-runs on every burst of writes
/// under the record directory — roughly once a second while an agent is working — so it must not
/// run on the main actor; and a `cwd` is written once and never changes, so re-reading every head
/// every second is work that only has to happen once per file.
public actor SessionDiscovery {
    /// Running + recently active. A Session quiet for longer than this is history: still on disk to
    /// be opened deliberately, but not what the cockpit is watching.
    public static let workingSetWindow: TimeInterval = 24 * 60 * 60

    private let store: TranscriptRecordStore
    /// Transcript path → the working directory read out of its head.
    ///
    /// Only successful reads are remembered. A head that could not be read yet — a file caught
    /// mid-first-record — is a question to ask again on the next sweep, and caching the "no" would
    /// hide that Session for the rest of the process's life.
    private var origins: [String: String] = [:]

    public init(store: TranscriptRecordStore = .claudeCode) {
        self.store = store
    }

    /// The transcripts to tail for one Project, newest first.
    ///
    /// A transcript whose working directory cannot be read belongs to no Project here. That is the
    /// degrade-down rule rather than a dropped file: attributing it to whichever Project was
    /// asking would be a fact Argo does not have.
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
