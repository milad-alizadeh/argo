import Foundation

/// What this watch is READING FOR: the working set the sweep answers with, and the tails moved onto
/// it.
///
/// Split from `TranscriptWatch.swift` for the reason `+Reading` is — the class body is capped, and
/// a cap is met by putting a half of the type where it belongs rather than by suppressing the gate.
@MainActor
extension TranscriptWatch {
    /// Move the tails onto the sweep's answer: a transcript recorded since the last one starts
    /// being tailed, and one that has aged out of the window stops — keeping its row, because it is
    /// the descriptors that are bounded and not the roster.
    func move(onto wanted: [URL]) async {
        let wantedIDs = Set(wanted.map(\.path))
        for transcript in join.transcripts where !wantedIDs.contains(transcript.id) {
            await stopReading(transcript)
        }
        for url in wanted where !isObserving(transcriptID: url.path) {
            // A file the sweep saw a moment ago can be gone by the time it is opened. Skipping it
            // is the honest answer: nobody named this file, and the next sweep sees it again if it
            // comes back — where a named transcript that cannot be read is a failed connection.
            // BOUNDED: a sweep reads the two ends of every transcript it admits and nothing
            // between them, which is what makes a week-wide working set affordable
            // (`TranscriptExcerpt`). The whole file is read on the click that selects it.
            //
            // At the extent this transcript is HELD at, which is only ever the bounded one at
            // launch: a Session whose reading was read whole and then paused would otherwise come
            // back as an excerpt, and — the reading now being replaced rather than appended to
            // (#1213) — silently lose the middle of the file the feed is drawing.
            //
            // A reading nobody SELECTED is not held whole, and comes back bounded even where the
            // live tail had since filled it in. That is the honest answer rather than a gap: the
            // row keeps saying `.excerpt`, which is what it said before, and the alternative is
            // the duplicate this ticket is about. What a reader opens is read whole on the click.
            let held: SessionTranscriptExtent = whole.holds(url.path) ? .whole : .excerpt
            guard let observation = try? observe(url, reading: held) else { continue }
            await startTailing(observation)
        }
        // Every sweep, not only the ones that moved a tail: a fan-out's files appear beside a
        // transcript that is already in the working set, so nothing above would notice them.
        for transcript in join.transcripts where isObserving(transcriptID: transcript.id) {
            subagents.refresh(of: transcript.id, beside: transcript.sourceURL)
        }
        // Last, so what it reads is the working set this sweep settled on rather than the one it
        // started from. A row re-keyed by the drop above reaches the claim that owns it here, and
        // here only: the batches that would otherwise carry it are behind the file that moved.
        onWorkingSetMoved()
    }

    /// Stop reading a transcript the sweep no longer names. Aged out of the window it keeps its
    /// row; GONE FROM DISK it loses it, because a vanished path can never say anything again — and
    /// Claude Code MOVES a transcript into the worktree's own record directory (#770).
    func stopReading(_ transcript: HubTranscript) async {
        guard FileManager.default.fileExists(atPath: transcript.sourceURL.path) else {
            await stopObserving(transcriptID: transcript.id)
            return
        }
        await pauseObserving(transcriptID: transcript.id)
    }

    /// Start tailing one transcript, keeping whatever row the roster already holds for it.
    ///
    /// The join resolves a record's owner by which transcript claimed it FIRST, so re-adding a
    /// paused resume-chain root would put it behind its own continuation and re-attribute the
    /// records it authored. A tail re-reads from the start of the file.
    ///
    /// Which is also why a transcript the join ALREADY holds is admitted as a reading again rather
    /// than as a new one: what a re-tail delivers first is everything its file already said, and
    /// folded onto the reading the pause left standing that is every row of it drawn twice
    /// (#1213). `reread` drops the reading instead, keeping the row on screen until the new one
    /// lands — the same reset a Subagent's tail takes on the same event
    /// (`SubagentReadings.beginReading`).
    func startTailing(_ observation: TranscriptObservation) async {
        await tail(observation) { join in
            join.holds(transcriptID: observation.id)
                ? join.reread(observation)
                : join.add(observation)
        }
    }
}
