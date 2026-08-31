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
    subject: TranscriptSubject = .session,
    readImage: @escaping ImageReader = noImageReader,
    readSkill: @escaping SkillReader = noSkillReader,
)
    -> AsyncStream<[TranscriptEvent]> {
    let reader = TranscriptReader(
        source: url,
        subject: subject,
        readImage: readImage,
        readSkill: readSkill,
    )
    return events(of: transcriptLines(at: url), read: reader)
}

/// The same reading, opened BOUNDED: the transcript's two ends as the backfill, and everything
/// appended after that as an ordinary tail (`TranscriptExcerpt`).
///
/// What a launch sweep takes, and the whole of why a week-wide working set is affordable. A Session
/// SELECTED is re-opened with `transcriptEvents` above, which reads the file whole.
public func transcriptExcerptEvents(
    at url: URL,
    readImage: @escaping ImageReader = noImageReader,
    readSkill: @escaping SkillReader = noSkillReader,
)
    -> AsyncStream<[TranscriptEvent]> {
    let reader = TranscriptReader(source: url, readImage: readImage, readSkill: readSkill)
    return events(
        of: transcriptLines(at: url, excerptSideLimit: TranscriptExcerpt.sideByteLimit),
        read: reader,
    )
}

/// One line stream folded into the batches of events it means. The two openings above differ in
/// where the first batch comes FROM and in nothing else, so this is written once.
private func events(
    of lines: AsyncStream<[TranscriptLine]>,
    read reader: TranscriptReader,
)
    -> AsyncStream<[TranscriptEvent]> {
    AsyncStream { continuation in
        let observation = Task {
            var isBackfill = true
            for await batch in lines {
                guard !Task.isCancelled else { break }
                let events = await reader.read(batch)
                // A later read that meant nothing is not news, and a consumer folding it in would
                // rebuild for a `system` record. The backfill is yielded whatever it holds: it is
                // what says the file has been read at all.
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
