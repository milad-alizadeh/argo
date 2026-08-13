import Foundation

/// The engine ports the app composes: transcript observation, repository checkout and process
/// liveness reads.
public struct Engine: Sendable {
    private let readCheckout: CheckoutRead
    private let readWorkspace: WorkspaceRead
    private let readLiveness: LivenessRead

    /// The `git`- and `ps`-backed reads are the app's adapters; a caller with no repository and no
    /// process table to read supplies its own.
    public init(
        readCheckout: @escaping CheckoutRead = gitCheckoutRead,
        readWorkspace: @escaping WorkspaceRead = gitWorkspaceRead,
        readLiveness: @escaping LivenessRead = processLivenessRead,
    ) {
        self.readCheckout = readCheckout
        self.readWorkspace = readWorkspace
        self.readLiveness = readLiveness
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
        await readCheckout(url)
    }

    /// The git working context of one folder, or nothing where git could not answer for it.
    public func workspace(at url: URL) async -> WorkspaceProjection? {
        await readWorkspace(url)
    }

    /// The working directories a live CLI is running in, right now.
    public func liveCwds() async -> Set<String> {
        await readLiveness()
    }
}
