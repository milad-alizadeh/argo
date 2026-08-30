import Foundation

/// The roster as published, and beside it which transcripts may be written into it directly.
///
/// A child's file joins no chain and moves no sort key, so the walk that built this must not run
/// again for its bytes (ADR-0028 Rule 1). What it must not do instead is publish them anywhere a
/// rebuild would not, so a transcript is only written in place where appending IS what the next
/// rebuild does.
struct HubRoster {
    private(set) var sessions: [HubSession] = []
    /// Transcript id — a PATH — to the row it may be written into directly. Absent for the two
    /// kinds of transcript below, whose readings wait for the rebuild that can place them.
    private var writableRow: [String: Int] = [:]
    /// The narrower map the Session's OWN batch is written through: the transcripts whose row is
    /// that transcript and nothing else. Narrower because a Session's batch changes the row's
    /// derived facts as well as its stream, and only where the fold merged nothing is replacing
    /// the row with the transcript's own Session identical to what the fold would have built.
    private var soloRow: [String: Int] = [:]

    init() {}

    init(chained: [HubSessionChain.Chained], transcripts: [HubTranscript]) {
        self.sessions = chained.map(\.session)
        let writable = Self.writableRows(of: chained, transcripts: transcripts)
        self.writableRow = writable
        self.soloRow = Self.soloRows(of: chained, transcripts: transcripts, within: writable)
    }

    /// Stop writing in place until the roster is folded again. What every rejection below decides
    /// is a fact about the SET — which uuids two paths carry, which link a chain ends on — so a
    /// set that has moved without the fold being retaken leaves this map older than the facts it
    /// encodes, and an answer it gives then is a guess.
    mutating func holdWrites() {
        writableRow = [:]
        soloRow = [:]
    }

    /// One Session's own batch, as the whole row it is published as. Answers whether it landed:
    /// everything this map does not name waits for the fold that can place it.
    mutating func replace(_ session: HubSession, from transcriptID: String) -> Bool {
        guard let row = soloRow[transcriptID] else { return false }
        sessions[row] = session
        return true
    }

    /// One Subagent's own reading, onto the published row its transcript may be written into.
    /// Everything else — a transcript this roster was built without, one held back above, and the
    /// two rejected below — reaches nothing here. Those readings are published by the next
    /// rebuild, except where that rebuild drops the transcript's whole reading with it: the frozen
    /// half of a moved file is not carried by any roster, before this change or after it.
    mutating func apply(
        _ read: [TranscriptEvent],
        ofSubagent agentID: String,
        from transcriptID: String,
    ) {
        guard let row = writableRow[transcriptID] else { return }
        sessions[row].apply(read, ofSubagent: agentID)
    }

    /// Two rejections, both of bytes a rebuild would put somewhere else.
    ///
    /// A link with a continuation merged BEHIND it: the chain folds root-first, so that link's
    /// reading is appended in front of the continuation's, where writing in place lands at the
    /// end. Only the chain's last link is written directly.
    ///
    /// And either half of a uuid two paths carry: that is one file the CLI moved, one half of it
    /// is a frozen prefix the graph drops, and which half is live is the graph's answer rather
    /// than this one's.
    private static func writableRows(
        of chained: [HubSessionChain.Chained],
        transcripts: [HubTranscript],
    )
        -> [String: Int] {
        var rowByChain: [String: Int] = [:]
        for (row, entry) in chained.enumerated() {
            guard let lastLink = entry.chainIDs.last else { continue }
            rowByChain[lastLink] = row
        }
        var paths: [String: Int] = [:]
        for transcript in transcripts {
            paths[transcript.sessionID, default: 0] += 1
        }
        return transcripts.reduce(into: [:]) { rows, transcript in
            guard paths[transcript.sessionID] == 1 else { return }
            rows[transcript.id] = rowByChain[transcript.sessionID]
        }
    }

    /// Of those, the rows a fold MERGED nothing into. Everything a chain of one link excludes is
    /// exactly what would make the transcript's own Session a different value from its row: no
    /// continuation to append behind it, no sibling whose merge order its times could flip, and —
    /// with the single path `writable` already demands — no other half of a moved file to lose to.
    private static func soloRows(
        of chained: [HubSessionChain.Chained],
        transcripts: [HubTranscript],
        within writable: [String: Int],
    )
        -> [String: Int] {
        let solo = Set(chained.filter { $0.chainIDs.count == 1 }.flatMap(\.chainIDs))
        return transcripts.reduce(into: [:]) { rows, transcript in
            guard solo.contains(transcript.sessionID) else { return }
            rows[transcript.id] = writable[transcript.id]
        }
    }
}
