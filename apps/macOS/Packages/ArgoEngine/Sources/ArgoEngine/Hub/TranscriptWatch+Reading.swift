import Foundation

/// What this watch is reading, and at what extent.
///
/// A sweep opens every transcript in the working set on a bounded read of its two ends
/// (`TranscriptExcerpt`); everything the feed draws lives in the stretch that read skips. So the
/// whole file is read on the click that selects the Session, and it stays read afterwards —
/// clicking
/// back is a lookup rather than a second drain (`WholeReadings`).
@MainActor
extension TranscriptWatch {
    /// What is being read, per transcript, in the order the transcripts joined the set.
    var observations: [HubObservation] {
        join.transcripts.map { transcript in
            HubObservation(
                id: transcript.id,
                sourceURL: transcript.sourceURL,
                state: tails[transcript.id] == nil ? .stopped : .live,
            )
        }
    }

    /// Read the chain under this row whole, and hold it.
    ///
    /// Idempotent, which is the whole claim: a Session already held costs nothing however many
    /// times
    /// it is clicked, and however many others are visited in between up to
    /// `WholeReadings.capacity`.
    func readWhole(rowID: String) async {
        let chain = join.chainedTranscriptIDs(of: rowID)
        guard !chain.isEmpty, !chain.allSatisfy(isReadWhole(transcriptID:)) else { return }
        for transcriptID in chain where !isReadWhole(transcriptID: transcriptID) {
            for evicted in whole.admit(transcriptID, eventsHeld: join.eventsHeld()) {
                await reopen(evicted, reading: .excerpt)
            }
            await reopen(transcriptID, reading: .whole)
        }
    }

    /// Whether this transcript's reading is being held whole.
    func isReadWhole(transcriptID: String) -> Bool {
        whole.holds(transcriptID)
    }

    /// Re-open one transcript at a different extent, keeping its place in the set and the row it
    /// already has. The reading it had is DROPPED rather than added to — see `HubJoin.reread`.
    private func reopen(_ transcriptID: String, reading extent: SessionTranscriptExtent) async {
        guard let sourceURL = join.transcripts.first(where: { $0.id == transcriptID })?.sourceURL
        else { return }
        if extent == .excerpt {
            whole.drop(transcriptID)
        }
        guard let observation = try? observe(sourceURL, reading: extent) else { return }
        await tail(observation) { $0.reread(observation) }
    }

    /// Every open this watch makes goes through here, and every one of them is counted: the count
    /// is what gates a full-history read being put back on the launch path
    /// (`TranscriptReadCostTests`), and a count is exactly load-independent where a duration is not
    /// (ADR-0028 Rule 8).
    func observe(
        _ url: URL,
        reading extent: SessionTranscriptExtent,
    ) throws
        -> TranscriptObservation {
        reads.opened(extent)
        switch extent {
        case .whole: return try engine.observeTranscript(at: url)
        case .excerpt: return try engine.surveyTranscript(at: url)
        }
    }
}
