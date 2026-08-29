import Foundation

/// The engine ports the app composes: transcript observation, repository checkout and process
/// liveness reads.
public struct Engine: Sendable {
    private let reads: EngineReads

    /// The `git`- and `ps`-backed reads are the app's adapters; a caller with no repository and no
    /// process table to read supplies its own set (`EngineReads`).
    public init(reads: EngineReads = .ofThisMachine) {
        self.reads = reads
    }

    public func observeTranscript(at url: URL) throws -> TranscriptObservation {
        let sourceURL = url.standardizedFileURL
        try validateTranscript(at: sourceURL)
        return observation(at: sourceURL)
    }

    /// Validates the whole collection before starting any long-lived file observations.
    public func observeTranscripts(at urls: [URL]) throws -> [TranscriptObservation] {
        let sourceURLs = normalizedTranscriptURLs(urls)
        for sourceURL in sourceURLs {
            try validateTranscript(at: sourceURL)
        }
        return sourceURLs.map(observation)
    }

    /// Which Subagents were written beside one Session's record.
    ///
    /// Kept apart from the observation below for the reason discovery's is: observing a file OPENS
    /// it, and this is asked on every sweep about files that are already being tailed.
    public func subagents(beside parentURL: URL) -> [SubagentTranscript] {
        SubagentTranscripts.beside(parentURL.standardizedFileURL)
    }

    /// One Subagent's record, read as the subject of its own file rather than as the parent's
    /// sidechain.
    ///
    /// Neither validated nor throwing, unlike a transcript: nobody NAMED these, so one that cannot
    /// be opened is a Subagent Argo has no reading for rather than a failed connection.
    public func observeSubagent(_ transcript: SubagentTranscript) -> SubagentObservation {
        SubagentObservation(
            agentID: transcript.agentID,
            sourceURL: transcript.url,
            // The same two disk reads a Session's own observation makes: a Subagent shows pictures
            // and loads skills like any other Agent, and the only difference is whose file it is.
            events: transcriptEvents(
                at: transcript.url,
                subject: .subagent,
                readImage: diskImageReader,
                readSkill: diskSkillReader,
            ),
        )
    }

    func normalizedTranscriptURLs(_ urls: [URL]) -> [URL] {
        var seenPaths: Set<String> = []
        return urls.compactMap { url in
            let sourceURL = url.standardizedFileURL
            return seenPaths.insert(sourceURL.path).inserted ? sourceURL : nil
        }
    }

    private func validateTranscript(at url: URL) throws {
        guard FileManager.default.isReadableFile(atPath: url.path) else {
            throw TranscriptObservationError.unreadable(url)
        }
    }

    private func observation(at url: URL) -> TranscriptObservation {
        TranscriptObservation(
            id: url.path,
            sourceURL: url,
            modifiedAt: modifiedAt(of: url),
            events: transcriptEvents(
                at: url,
                readImage: diskImageReader,
                readSkill: diskSkillReader,
            ),
        )
    }

    /// The file's own last-write time, or nothing. Read once at observation rather than re-statted,
    /// because what it stands in for is when the Session last ran — and a transcript that is still
    /// being written reports that through its records instead.
    private func modifiedAt(of url: URL) -> Date? {
        try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
    }

    public func checkout(at url: URL) async -> CheckoutProjection {
        await reads.checkout(url)
    }

    /// Every working tree the repository holding this folder has, in git's own order — and none for
    /// a folder that is in no repository.
    public func worktrees(in url: URL) async -> [WorktreeEntry] {
        await reads.worktrees(url)
    }

    /// The git working context of one working tree, or nothing where git could not answer for it.
    public func workspace(of entry: WorktreeEntry) async -> WorkspaceProjection? {
        await reads.workspace(entry)
    }

    /// The working directories a live CLI is running in, right now.
    public func liveCwds() async -> Set<String> {
        await reads.liveness()
    }

    /// How the file system spells each of these paths. A read like the four above and for their
    /// reason: it opens the file system, so it happens here rather than wherever the answer is
    /// wanted (ADR-0028 Rule 6).
    public func resolvedPaths(_ paths: [String]) async -> [String: String] {
        await reads.paths(paths)
    }
}
