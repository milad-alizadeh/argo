import Foundation

/// Typed events already present in one transcript, followed by typed events appended later.
public func transcriptEvents(
    at url: URL,
    readImage: @escaping ImageReader = noImageReader,
)
    -> AsyncStream<TranscriptEvent> {
    let reader = TranscriptReader(readImage: readImage)
    return AsyncStream { continuation in
        let observation = Task {
            for await line in transcriptLines(at: url) {
                guard !Task.isCancelled else { break }
                for event in await reader.read(line: line) {
                    continuation.yield(event)
                }
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in observation.cancel() }
    }
}
