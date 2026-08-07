import Foundation

/// The engine ports the app composes: transcript observation and repository checkout reads.
public struct Engine: Sendable {
    private let checkoutReader: CheckoutReader

    public init() {
        self.checkoutReader = CheckoutReader()
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
            events: transcriptEvents(at: url, readImage: diskImageReader),
        )
    }

    public func checkout(at url: URL) async -> CheckoutProjection {
        await checkoutReader.read(at: url)
    }
}
