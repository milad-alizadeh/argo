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

    init() {}

    init(chained: [HubSessionChain.Chained], transcripts: [HubTranscript]) {
        self.sessions = chained.map(\.session)
        self.writableRow = Self.writableRows(of: chained, transcripts: transcripts)
    }

    /// One Subagent's own reading, onto the published row its transcript may be written into.
    /// Everything else — a transcript this roster was built without, and the two rejected below —
    /// reaches nothing here, and arrives with the next rebuild.
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
}
