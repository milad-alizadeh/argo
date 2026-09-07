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
    return events(of: transcriptLines(at: url)) { TranscriptOpening(reader: reader) }
}

/// The same reading, opened BOUNDED: the transcript's two ends as the backfill, and everything
/// appended after that as an ordinary tail (`TranscriptExcerpt`).
///
/// What a launch sweep takes, and the whole of why a week-wide working set is affordable. A Session
/// SELECTED is re-opened with `transcriptEvents` above, which reads the file whole.
///
/// The Plan is the one fact the two ends cannot carry, so it is read separately, by a walk of the
/// whole file for those records alone (`TranscriptPlanScan`). The scan hands over its LEDGER and
/// not just its answer, so a step written after this read folds onto the list already drawn — and
/// so the two ends, re-reading writes the scan has spent, report none of them again (#1594).
public func transcriptExcerptEvents(
    at url: URL,
    readImage: @escaping ImageReader = noImageReader,
    readSkill: @escaping SkillReader = noSkillReader,
)
    -> AsyncStream<[TranscriptEvent]> {
    events(of: transcriptLines(at: url, excerptSideLimit: TranscriptExcerpt.sideByteLimit)) {
        let scan = await TranscriptPlanScan.scanning(url)
        let reader = TranscriptReader(source: url, readImage: readImage, readSkill: readSkill)
        await reader.takeUp(scan.ledger)
        return TranscriptOpening(reader: reader, events: scan.plan.map { [.plan($0)] } ?? [])
    }
}

/// What one opening read is made of: the reader that folds its lines, and the events that are true
/// before the first of them is read.
struct TranscriptOpening: Sendable {
    let reader: TranscriptReader
    /// Read from the file by something other than the line stream, and so carried WITH the backfill
    /// rather than found in it. Empty for a whole reading, which finds everything itself.
    var events: [TranscriptEvent] = []
}

/// One line stream folded into the batches of events it means. The two openings above differ in
/// where the first batch comes FROM and in nothing else, so this is written once.
///
/// The opening is built INSIDE the task rather than handed in: it reads the file, and every caller
/// here is on the main actor.
private func events(
    of lines: AsyncStream<[TranscriptLine]>,
    opening: @escaping @Sendable () async -> TranscriptOpening,
)
    -> AsyncStream<[TranscriptEvent]> {
    AsyncStream { continuation in
        let observation = Task {
            let opened = await opening()
            var isBackfill = true
            for await batch in lines {
                guard !Task.isCancelled else { break }
                let events = await opened.reader.read(batch)
                // A later read that meant nothing is not news, and a consumer folding it in would
                // rebuild for a `system` record. The backfill is yielded whatever it holds: it is
                // what says the file has been read at all.
                //
                // The opening's events go AFTER the backfill's, because the only one of them is a
                // Plan the two ends could not rebuild: a consumer takes the last plan it sees, and
                // the ledger has already spent every write the ends carry, so nothing in `events`
                // is a newer list. In front, a whole-list write in the file's head would win.
                if isBackfill || !events.isEmpty {
                    continuation.yield(isBackfill ? events + opened.events : events)
                }
                isBackfill = false
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in observation.cancel() }
    }
}
