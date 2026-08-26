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
            for continuationID in graph.continuations(of: id, claimed: &claimed) {
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

/// Which transcript continues which, resolved once per rebuild.
///
/// A tree rather than a list, because the origin fallback below groups by the chain's ROOT: a run
/// that entered a worktree twice leaves two continuations naming one origin, and they are siblings.
private struct HubChainGraph {
    private let byID: [String: HubSession]
    private let children: [String: [String]]
    let roots: [String]

    init(transcripts: [HubTranscript], owners: [String: String]) {
        var byID: [String: HubSession] = [:]
        for transcript in transcripts where byID[transcript.id] == nil {
            byID[transcript.id] = transcript.session
        }
        var children: [String: [String]] = [:]
        var roots: [String] = []
        for transcript in transcripts {
            guard let parentID = Self.parentID(of: transcript, owners: owners, known: byID),
                  parentID != transcript.id
            else {
                roots.append(transcript.id)
                continue
            }
            children[parentID, default: []].append(transcript.id)
        }
        self.byID = byID
        self.children = children
        self.roots = roots
    }

    func session(_ id: String) -> HubSession? {
        byID[id]
    }

    /// Every unclaimed transcript downstream of this one, in the order they must be merged: each
    /// continuation before its own, so the later half of a reading lands behind the earlier.
    func continuations(of id: String, claimed: inout Set<String>) -> [String] {
        var chain: [String] = []
        append(descendantsOf: id, to: &chain, claimed: &claimed)
        return chain
    }

    private func append(
        descendantsOf id: String,
        to chain: inout [String],
        claimed: inout Set<String>,
    ) {
        for childID in children[id] ?? [] where !claimed.contains(childID) {
            claimed.insert(childID)
            chain.append(childID)
            append(descendantsOf: childID, to: &chain, claimed: &claimed)
        }
    }

    /// A resume names a record in the file it continues, and that is the immediate link. A worktree
    /// relocation names none — the two halves share no uuid, requestId or promptId — so it falls
    /// back to the origin session id, which is the chain's ROOT rather than its predecessor and so
    /// composes with the walk above (#735).
    ///
    /// A leaf the transcript owns ITSELF counts as a miss, not a link: the relocated file's
    /// `last-prompt` record names its own newest record.
    private static func parentID(
        of transcript: HubTranscript,
        owners: [String: String],
        known: [String: HubSession],
    )
        -> String? {
        if let holder = transcript.session.headLeafUUID.flatMap({ owners[$0] }),
           holder != transcript.id {
            return holder
        }
        // Only against a transcript actually in the set: a worktree directory opened on its own is
        // a Session of its own, not a row dropped for want of its origin.
        guard let origin = transcript.session.originSessionID, known[origin] != nil else {
            return nil
        }
        return origin
    }
}
