import Foundation

/// Typed events already present in one transcript, followed by typed events appended later — in the
/// batches `transcriptLines` read them in, the first element being the backfill of what the file
/// already held, empty or not.
///
/// The batch is carried through rather than flattened because both things downstream needs are
/// carried by it: the Hub folds a whole read into the join at once instead of rebuilding per line,
/// and the first batch is what tells it the file has been read at all.
public func transcriptEvents(
    at url: URL,
    readImage: @escaping ImageReader = noImageReader,
)
    -> AsyncStream<[TranscriptEvent]> {
    let reader = TranscriptReader(readImage: readImage)
    return AsyncStream { continuation in
        let observation = Task {
            var isBackfill = true
            for await lines in transcriptLines(at: url) {
                guard !Task.isCancelled else { break }
                let events = await reader.read(lines: lines)
                if isBackfill || !events.isEmpty {
                    continuation.yield(events)
                }
                isBackfill = false
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in observation.cancel() }
    }
}
