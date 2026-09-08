import Foundation

extension HubJoin {
    /// Drop one transcript's row. A transcript the set never held drops nothing.
    @discardableResult
    mutating func remove(transcriptID: String) -> Bool {
        guard let index = position(of: transcriptID) else { return false }
        let sessionID = transcripts[index].sessionID
        transcripts.removeAll { $0.id == transcriptID }
        // Every position after the one dropped has moved, so the table is taken again whole.
        positions = Dictionary(transcripts.enumerated().map { ($1.id, $0) }) { first, _ in first }
        recordOwners = recordOwners.filter { $0.value != transcriptID }
        if transcripts.contains(where: { $0.sessionID == sessionID }) {
            retiredTranscriptIDs[sessionID, default: []].append(transcriptID)
        } else {
            retiredTranscriptIDs.removeValue(forKey: sessionID)
        }
        needsFold = true
        return true
    }

    /// Re-key a transcript whose file moved, keeping its settled reading on the roster until the
    /// replacement path has delivered its first batch.
    mutating func relocate(
        _ observation: TranscriptObservation,
        from transcriptID: String,
    )
        -> Bool {
        guard !holds(transcriptID: observation.id),
              let index = position(of: transcriptID)
        else { return false }
        let sessionID = observation.sourceURL.deletingPathExtension().lastPathComponent
        guard transcripts[index].sessionID == sessionID else { return false }
        retiredTranscriptIDs[sessionID, default: []].append(transcriptID)
        transcripts[index].relocate(to: observation)
        positions.removeValue(forKey: transcriptID)
        positions[observation.id] = index
        recordOwners = recordOwners.mapValues { $0 == transcriptID ? observation.id : $0 }
        if standing.remove(transcriptID) != nil {
            standing.insert(observation.id)
        }
        needsFold = true
        roster.holdWrites()
        // The roster still publishes the stale reading under its old id. The replacement batch is
        // the visible move, so this join write has nothing to publish yet.
        return false
    }
}
