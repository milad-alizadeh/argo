import Foundation

struct HubTranscript {
    let id: String
    /// The file, held here rather than read back off the Session: a Session Argo spawned has no
    /// transcript yet, so its own answer is absent.
    let sourceURL: URL
    var session: HubSession
    /// Whether the tail has delivered what the file already held. Until it has, this transcript is
    /// in the join — so the records it claims are attributed in tail-start order — but the roster
    /// it belongs to is not published.
    var isSettled = false

    init(observation: TranscriptObservation) {
        self.id = observation.id
        self.sourceURL = observation.sourceURL
        self.session = HubSession(observation: observation)
    }
}

enum HubSessionChain {
    static func sessions(
        from transcripts: [HubTranscript],
        owners: [String: String],
    )
        -> [HubSession] {
        let graph = HubChainGraph(transcripts: transcripts, owners: owners)
        var claimed: Set<String> = []
        var sessions: [HubSession] = []
        for id in graph.roots + transcripts.map(\.id) where !claimed.contains(id) {
            guard var session = graph.session(id) else { continue }
            claimed.insert(id)
            for continuationID in graph.claimContinuations(of: id, into: &claimed) {
                guard let continuation = graph.session(continuationID) else { continue }
                session.mergeContinuation(continuation)
            }
            sessions.append(session)
        }
        // A QUEUED prompt nothing has answered is not a Session. The CLI opens a transcript per
        // queued prompt, so a Session queued several leaves several files, each holding one copy of
        // the same words and no agent output — which the roster drew as that Session once per file.
        //
        // Both halves are load-bearing: queued alone is an ordinary Session whose prompt arrived
        // through the queue, unanswered alone is one that has only just started. Only the pair is a
        // file nothing will ever write to again.
        //
        // Dropped at publication rather than at discovery: the file is still tailed, so if an agent
        // does pick the prompt up, its row appears without another sweep having to find it.
        return ordered(sessions.filter { !$0.isQueued || $0.hasAgentActivity })
    }

    /// Newest activity first, with the id breaking a tie. A Session that can say nothing about when
    /// it ran sorts behind every one that can, never in front on a guessed zero.
    static func ordered(_ sessions: [HubSession]) -> [HubSession] {
        sessions.sorted { first, second in
            guard first.lastSeenAtMs != second.lastSeenAtMs else { return first.id < second.id }
            guard let firstKey = first.lastSeenAtMs else { return false }
            guard let secondKey = second.lastSeenAtMs else { return true }
            return firstKey > secondKey
        }
    }
}
