import Foundation

/// One published Session and the chain uuids folded into it, as the walk over the chain graph
/// hands them over.
struct HubChainedSession {
    let session: HubSession
    let chainIDs: [String]
}

/// The roster as published, and beside it which Session each transcript landed on.
///
/// The map is what a Subagent's bytes take to reach one row: a child's file joins no chain and
/// moves no sort key, so the walk that built this must not run again for it (ADR-0028 Rule 1).
struct HubRoster {
    private(set) var sessions: [HubSession] = []
    /// Transcript id — a PATH — to its position in `sessions`. Keyed by transcript and not by
    /// chain uuid because a read arrives against the file it was read beside, and a chain that
    /// merged three transcripts publishes one row for all three.
    private var indexByTranscript: [String: Int] = [:]

    init() {}

    init(chained: [HubChainedSession], transcripts: [HubTranscript]) {
        var indexByChain: [String: Int] = [:]
        for (index, entry) in chained.enumerated() {
            for id in entry.chainIDs {
                indexByChain[id] = index
            }
        }
        self.sessions = chained.map(\.session)
        self.indexByTranscript = transcripts.reduce(into: [:]) { map, transcript in
            map[transcript.id] = indexByChain[transcript.sessionID]
        }
    }

    /// One Subagent's own reading, onto the published row its transcript landed on. A transcript
    /// this roster was built without — one the sweep admitted a moment ago — reaches nothing here,
    /// and its bytes arrive with the rebuild that publishes it.
    mutating func apply(
        _ read: [TranscriptEvent],
        ofSubagent agentID: String,
        from transcriptID: String,
    ) {
        guard let index = indexByTranscript[transcriptID] else { return }
        sessions[index].apply(read, ofSubagent: agentID)
    }
}
