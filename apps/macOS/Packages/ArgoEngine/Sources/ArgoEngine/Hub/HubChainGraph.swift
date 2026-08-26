/// Which transcript continues which, resolved once per rebuild.
///
/// A tree rather than a list: a run that entered a worktree twice leaves two continuations naming
/// one origin, and they are siblings.
struct HubChainGraph {
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
        self.children = children.mapValues { ids in
            ids.sorted { Self.isEarlier($0, $1, in: byID) }
        }
        self.roots = roots
    }

    /// Siblings are merged oldest first. Discovery hands transcripts over NEWEST first, so taking
    /// them in the order they arrived would merge a run's second worktree before its first — which
    /// reverses the feed and leaves the row reading the stale worktree.
    private static func isEarlier(
        _ first: String,
        _ second: String,
        in byID: [String: HubSession],
    )
        -> Bool {
        let firstKey = byID[first]?.startedAtMs ?? byID[first]?.lastSeenAtMs
        let secondKey = byID[second]?.startedAtMs ?? byID[second]?.lastSeenAtMs
        guard firstKey != secondKey else { return first < second }
        // A transcript that can say nothing about when it ran merges last, never in front on a
        // guessed zero — the same rule the roster's own ordering keeps.
        guard let firstKey else { return false }
        guard let secondKey else { return true }
        return firstKey < secondKey
    }

    func session(_ id: String) -> HubSession? {
        byID[id]
    }

    /// Take every unclaimed transcript downstream of this one, in the order they must be merged:
    /// each continuation before its own, so the later half of a reading lands behind the earlier.
    func claimContinuations(of id: String, into claimed: inout Set<String>) -> [String] {
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
    /// composes with the walk that reads this graph (#735).
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
