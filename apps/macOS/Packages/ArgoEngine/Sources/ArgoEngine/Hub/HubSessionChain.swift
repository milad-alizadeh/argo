import Foundation

struct HubTranscript {
    let id: String
    /// The file, held here rather than read back off the Session: a Session Argo spawned has no
    /// transcript yet, so its own answer is absent.
    let sourceURL: URL
    /// The chain's own uuid, which is the file's NAME — a different key from `id`, which is its
    /// PATH. Relocation links on this one: the origin a relocated record names is a bare uuid, and
    /// a run whose file MOVED keeps its uuid while its path changes (#770).
    let sessionID: String
    var session: HubSession
    /// Whether the tail has delivered what the file already held. Until it has, this transcript is
    /// in the join — so the records it claims are attributed in tail-start order — but the roster
    /// it belongs to is not published.
    var isSettled = false

    init(observation: TranscriptObservation) {
        self.id = observation.id
        self.sourceURL = observation.sourceURL
        self.sessionID = observation.sourceURL.deletingPathExtension().lastPathComponent
        self.session = HubSession(observation: observation)
    }
}

enum HubSessionChain {
    /// One published Session and the chain uuids folded into it, in the order they were folded.
    struct Chained {
        let session: HubSession
        let chainIDs: [String]
    }

    static func roster(
        from transcripts: [HubTranscript],
        owners: [String: String],
    )
        -> HubRoster {
        let graph = HubChainGraph(transcripts: transcripts, owners: owners)
        var claimed: Set<String> = []
        var chained: [Chained] = []
        // Walked in the graph's own key, which is the chain uuid rather than the path: two paths
        // carrying one uuid are one Session, and the second of them is claimed by the first.
        for id in graph.roots + transcripts.map(\.sessionID) where !claimed.contains(id) {
            guard var session = graph.session(id) else { continue }
            claimed.insert(id)
            var chainIDs = [id]
            for continuationID in graph.claimContinuations(of: id, into: &claimed) {
                guard let continuation = graph.session(continuationID) else { continue }
                session.mergeContinuation(continuation)
                chainIDs.append(continuationID)
            }
            chained.append(Chained(session: session, chainIDs: chainIDs))
        }
        return HubRoster(chained: published(chained), transcripts: transcripts)
    }

    /// The Sessions of those chains that the roster actually draws, in the order it draws them.
    private static func published(_ chained: [Chained]) -> [Chained] {
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
        chained
            .filter { !$0.session.isQueued || $0.session.hasAgentActivity }
            .sorted { isAhead($0.session, $1.session) }
    }

    /// Newest activity first, with the id breaking a tie. A Session that can say nothing about when
    /// it ran sorts behind every one that can, never in front on a guessed zero.
    static func ordered(_ sessions: [HubSession]) -> [HubSession] {
        sessions.sorted(by: isAhead)
    }

    private static func isAhead(_ first: HubSession, _ second: HubSession) -> Bool {
        guard first.lastSeenAtMs != second.lastSeenAtMs else { return first.id < second.id }
        guard let firstKey = first.lastSeenAtMs else { return false }
        guard let secondKey = second.lastSeenAtMs else { return true }
        return firstKey > secondKey
    }
}
