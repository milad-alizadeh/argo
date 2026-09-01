import Foundation

/// The roster as published, and beside it which transcripts may be written into it directly.
///
/// A Session's own batch changes the row it is published as and nothing else, so the walk that
/// built this must not run again for it (ADR-0028 Rule 1). What it must not do instead is publish
/// anywhere a rebuild would not, so a transcript is only written in place where replacing the row
/// IS what the next rebuild does.
struct HubRoster {
    private(set) var sessions: [HubSession] = []
    /// Transcript id — a PATH — to the row a Session's OWN batch may be written into directly.
    /// Absent for every transcript whose row a rebuild would build differently, which is what
    /// `writableRows` and `soloRows` between them decide.
    private var soloRow: [String: Int] = [:]

    init() {}

    init(chained: [HubSessionChain.Chained], transcripts: [HubTranscript]) {
        self.sessions = chained.map(\.session)
        self.soloRow = Self.soloRows(
            of: chained,
            transcripts: transcripts,
            within: Self.writableRows(of: chained, transcripts: transcripts),
        )
    }

    /// Stop writing in place until the roster is folded again. What every rejection below decides
    /// is a fact about the SET — which uuids two paths carry, which link a chain ends on — so a
    /// set that has moved without the fold being retaken leaves this map older than the facts it
    /// encodes, and an answer it gives then is a guess.
    mutating func holdWrites() {
        soloRow = [:]
    }

    /// One Session's own batch, as the whole row it is published as. Answers whether it landed:
    /// everything this map does not name waits for the fold that can place it.
    mutating func replace(_ session: HubSession, from transcriptID: String) -> Bool {
        guard let row = soloRow[transcriptID] else { return false }
        sessions[row] = session
        return true
    }

    /// Two rejections, both of a row a rebuild would build differently.
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
