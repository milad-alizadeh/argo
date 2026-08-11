import Foundation

/// The claude adapter's decide channel (ADR-0024): one Unix socket per claim that the spawned
/// session's `PreToolUse` hook dials, blocks on, and takes its decision back down.
///
/// Every answer it sends is `allow` or `deny`, never `ask` — `ask` would fall through to the TUI's
/// own dialog, which is hidden and has no reader.
///
/// Two ways a prompt ends unanswered, and they are told apart rather than run together (#573). The
/// gate keeps its OWN clock, shorter than the hook's, so a call nobody answers is refused **by
/// Argo** and published as a `PermissionExpiry` the feed reports. A peer going before that clock
/// fires went with the turn it belonged to — the user cancelled — and takes its prompt away in
/// silence, because a prompt that vanishes when you cancel its turn is the expected answer.
@MainActor
final class PermissionChannel {
    private struct Pending {
        let request: PermissionRequest
        let peer: Int
        let reply: CompanionConnection.Reply
        /// The gate's own clock for this one call, cancelled by every other way it can end.
        let clock: Task<Void, Never>
    }

    private let root: URL
    private let patience: PermissionPatience
    private let onChange: (SessionOwnership.ClaimID, [PermissionRequest]) -> Void
    private let onStanding: (SessionOwnership.ClaimID, [StandingAllow]) -> Void
    private let onExpired: (SessionOwnership.ClaimID, [PermissionExpiry]) -> Void
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
    private var pending: [SessionOwnership.ClaimID: [Pending]] = [:]
    private var expired: [SessionOwnership.ClaimID: [PermissionExpiry]] = [:]
    private var standing = StandingAllowTable()
    private var issued = 0

    init(
        root: URL,
        patience: PermissionPatience = .default,
        onChange: @escaping (SessionOwnership.ClaimID, [PermissionRequest]) -> Void,
        onStanding: @escaping (SessionOwnership.ClaimID, [StandingAllow]) -> Void,
        onExpired: @escaping (SessionOwnership.ClaimID, [PermissionExpiry]) -> Void,
    ) {
        self.root = root
        self.patience = patience
        self.onChange = onChange
        self.onStanding = onStanding
        self.onExpired = onExpired
    }

    /// Open this claim's gate and say where its hook should dial.
    func grant(_ claim: SessionOwnership.ClaimID) throws -> String {
        try FileManager.default.createDirectory(
            at: root,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700],
        )
        let path = root.appending(path: "\(claim.value).gate.sock").path
        let socket = CompanionSocket(
            path: path,
            endsAfterReply: true,
            onPeerClosed: { [weak self] peer in self?.peerClosed(claim, peer: peer) },
            respond: { [weak self] line, peer, reply in
                self?.asked(claim, line: line, peer: peer, reply: reply)
            },
        )
        try socket.open()
        sockets[claim] = socket
        return path
    }

    /// The PTY is gone, so nothing can be waiting, nothing more can ask, and no grant made against
    /// it has anything left to hold open.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        sockets.removeValue(forKey: claim)?.close()
        if standing.withdraw(claim) {
            onStanding(claim, [])
        }
        // The expiries go with the claim for the reason the grants do: they are what happened to
        // THIS Session, and a Session that no longer exists has no reading left to say it in.
        if expired.removeValue(forKey: claim) != nil {
            onExpired(claim, [])
        }
        guard let waiting = pending.removeValue(forKey: claim) else { return }
        // Silence, deliberately. The PTY is gone, so nothing was refused and nothing is left to
        // read a refusal — the whole Session left with it.
        stop(waiting)
        onChange(claim, [])
    }

    func withdrawAll() {
        for claim in sockets.keys {
            withdraw(claim)
        }
    }

    /// Answer the named waiting Permission. `false` when that request is no longer waiting — a
    /// decision that raced the hook's own expiry, which the caller reports rather than swallows.
    ///
    /// By id and never by position: a Session can have several calls waiting at once, and a prompt
    /// that was replaced between the reading and the click would otherwise spend the user's Allow
    /// on the command underneath it.
    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for claim: SessionOwnership.ClaimID,
    )
        -> Bool {
        guard var waiting = pending[claim],
              let index = waiting.firstIndex(where: { $0.request.id == requestID })
        else { return false }
        let answered = waiting.remove(at: index)
        pending[claim] = waiting
        stop([answered])
        answered.reply(PermissionReply.line(decision))
        guard decision == .allowAlways else {
            onChange(claim, waiting.map(\.request))
            return true
        }
        stand(answered.request.toolName, for: claim)
        return true
    }

    /// Take a standing allow back, which is the whole reason it is a value the Session publishes
    /// rather than a set the gate keeps (#572). Nothing in flight is disturbed and the Session is
    /// not touched — the next call to that tool simply asks again. `false` when there was no such
    /// grant to take back.
    func revoke(_ toolName: String, for claim: SessionOwnership.ClaimID) -> Bool {
        guard standing.revoke(toolName, for: claim) else { return false }
        onStanding(claim, standing.grants(for: claim))
        return true
    }

    /// Record the grant, and let every OTHER call to that tool already waiting through on the same
    /// word. A prompt still sitting there for a tool that has stopped asking would be the grant not
    /// meaning what its label says.
    private func stand(_ toolName: String, for claim: SessionOwnership.ClaimID) {
        if standing.grant(toolName, for: claim) {
            onStanding(claim, standing.grants(for: claim))
        }
        let waiting = pending[claim] ?? []
        let covered = waiting.filter { $0.request.toolName == toolName }
        let remaining = waiting.filter { $0.request.toolName != toolName }
        pending[claim] = remaining
        stop(covered)
        for one in covered {
            one.reply(PermissionReply.line(.allow))
        }
        onChange(claim, remaining.map(\.request))
    }

    /// The gate's clock for one call: it runs out, Argo refuses the call itself, and the Session
    /// publishes what happened. Argo's own act from end to end, which is what lets the feed say a
    /// tool call was refused by nobody without inventing the claim.
    private func arm(_ request: PermissionRequest, for claim: SessionOwnership.ClaimID)
        -> Task<Void, Never> {
        Task { [weak self, patience] in
            try? await Task.sleep(for: .seconds(patience.seconds))
            guard !Task.isCancelled else { return }
            self?.expire(request.id, for: claim)
        }
    }

    private func expire(_ requestID: String, for claim: SessionOwnership.ClaimID) {
        guard var waiting = pending[claim],
              let index = waiting.firstIndex(where: { $0.request.id == requestID })
        else { return }
        let gone = waiting.remove(at: index)
        pending[claim] = waiting
        gone.reply(PermissionReply.expired)
        expired[claim, default: []].append(PermissionExpiry(gone.request))
        onExpired(claim, expired[claim] ?? [])
        onChange(claim, waiting.map(\.request))
    }

    /// Every way a Permission can end that is not its clock running out stops that clock first — an
    /// answered call whose timer still fires would report an expiry over a decision somebody made.
    private func stop(_ taken: [Pending]) {
        for one in taken {
            one.clock.cancel()
        }
    }

    private func asked(
        _ claim: SessionOwnership.ClaimID,
        line: String,
        peer: Int,
        reply: @escaping CompanionConnection.Reply,
    ) {
        issued += 1
        guard let request = PermissionRequest(line: line, id: "permission-\(issued)") else {
            // Fail closed, and fast: a request Argo could not read is not one the user can be
            // shown, and leaving the hook to its timeout would freeze the turn for nothing.
            return reply(PermissionReply.line(.deny))
        }
        // The standing allow, applied where the round trip would otherwise start: a tool the user
        // has already ruled on for this Session never becomes a prompt at all. Every other tool
        // takes the per-action path below, untouched.
        guard !standing.allows(request.toolName, for: claim) else {
            return reply(PermissionReply.line(.allow))
        }
        pending[claim, default: []].append(Pending(
            request: request,
            peer: peer,
            reply: reply,
            clock: arm(request, for: claim),
        ))
        onChange(claim, pending[claim, default: []].map(\.request))
    }

    /// The hook went while Argo was still willing to wait, which means the turn it belonged to was
    /// cancelled: Argo's own clock is the shorter of the two, so an expiry can never arrive this
    /// way. Its questions are over and the prompt goes without a word — cancelling a turn is the
    /// user answering, and a notice explaining what they just did explains nothing (#573).
    private func peerClosed(_ claim: SessionOwnership.ClaimID, peer: Int) {
        guard let waiting = pending[claim], waiting.contains(where: { $0.peer == peer })
        else { return }
        let remaining = waiting.filter { $0.peer != peer }
        pending[claim] = remaining
        stop(waiting.filter { $0.peer == peer })
        onChange(claim, remaining.map(\.request))
    }
}
