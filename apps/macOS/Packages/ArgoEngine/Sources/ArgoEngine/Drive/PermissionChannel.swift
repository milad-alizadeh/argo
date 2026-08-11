import Foundation

/// The claude adapter's decide channel (ADR-0024): one Unix socket per claim that the spawned
/// session's `PreToolUse` hook dials, blocks on, and takes its decision back down.
///
/// Every answer it sends is `allow` or `deny`, never `ask` — `ask` would fall through to the TUI's
/// own dialog, which is hidden and has no reader.
///
/// Two ways a prompt ends unanswered, told apart (#573). The gate keeps its OWN clock, shorter
/// than the hook's, so a call nobody answers is refused **by Argo** and published as a
/// `PermissionExpiry`. A peer going before that clock fires went with a cancelled turn, and takes
/// its prompt away in silence.
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
    /// Written into directly rather than mirrored back through callbacks (#634): all three readings
    /// this channel owns land under one claim key, so there is nothing left for a caller to route.
    private let ledger: ClaimLedger
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
    private var pending: [SessionOwnership.ClaimID: [Pending]] = [:]
    private var expired: [SessionOwnership.ClaimID: [PermissionExpiry]] = [:]
    private var standing = StandingAllowTable()
    private var issued = 0

    init(root: URL, patience: PermissionPatience = .default, ledger: ClaimLedger) {
        self.root = root
        self.patience = patience
        self.ledger = ledger
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

    /// The PTY is gone: nothing can be waiting, nothing more can ask, no grant holds anything open.
    /// All three go together, in one write to the ledger, which three separate tables could not do.
    ///
    /// The waiting calls go in silence, deliberately: nothing was refused and nothing is left to
    /// read a refusal. Their clocks are cancelled first, because a day-long `Task` sleeping against
    /// a torn-down gate is a leak rather than a bug.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        sockets.removeValue(forKey: claim)?.close()
        _ = standing.withdraw(claim)
        // The expiries go with the claim: they are what happened to THIS Session.
        expired.removeValue(forKey: claim)
        cancelClocks(of: pending.removeValue(forKey: claim) ?? [])
        ledger.withdraw(claim)
    }

    /// Answer the named waiting Permission. `false` when that request is no longer waiting — a
    /// decision that raced the hook's own expiry, which the caller reports rather than swallows.
    ///
    /// By id and never by position: a Session can have several calls waiting at once, and a prompt
    /// replaced between the reading and the click would spend the Allow on the command underneath.
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
        cancelClocks(of: [answered])
        answered.reply(PermissionReply.line(decision))
        guard decision == .allowAlways else {
            ledger.publish(waiting: waiting.map(\.request), for: claim)
            return true
        }
        stand(answered.request.toolName, for: claim)
        return true
    }

    /// Take a standing allow back (#572). Nothing in flight is disturbed and the Session is not
    /// touched — the next call to that tool simply asks again. `false` when there was no grant.
    func revoke(_ toolName: String, for claim: SessionOwnership.ClaimID) -> Bool {
        guard standing.revoke(toolName, for: claim) else { return false }
        ledger.publish(standing: standing.grants(for: claim), for: claim)
        return true
    }

    /// Record the grant, and let every OTHER call to that tool already waiting through on the same
    /// word. A prompt still sitting there for a tool that has stopped asking would be the grant not
    /// meaning what its label says.
    private func stand(_ toolName: String, for claim: SessionOwnership.ClaimID) {
        if standing.grant(toolName, for: claim) {
            ledger.publish(standing: standing.grants(for: claim), for: claim)
        }
        let waiting = pending[claim] ?? []
        let covered = waiting.filter { $0.request.toolName == toolName }
        let remaining = waiting.filter { $0.request.toolName != toolName }
        pending[claim] = remaining
        cancelClocks(of: covered)
        for one in covered {
            one.reply(PermissionReply.line(.allow))
        }
        ledger.publish(waiting: remaining.map(\.request), for: claim)
    }

    /// The gate's clock for one call: it runs out, Argo refuses the call itself, and the Session
    /// publishes what happened — DIRECT, Argo's own act from end to end.
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
        ledger.publish(expired: expired[claim] ?? [], for: claim)
        ledger.publish(waiting: waiting.map(\.request), for: claim)
    }

    /// Every way a Permission can end that is not its clock running out stops that clock first — an
    /// answered call whose timer still fires would report an expiry over a decision somebody made.
    private func cancelClocks(of taken: [Pending]) {
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
        // A tool the user has already ruled on for this Session never becomes a prompt at all.
        guard !standing.allows(request.toolName, for: claim) else {
            return reply(PermissionReply.line(.allow))
        }
        pending[claim, default: []].append(Pending(
            request: request,
            peer: peer,
            reply: reply,
            clock: arm(request, for: claim),
        ))
        ledger.publish(waiting: pending[claim, default: []].map(\.request), for: claim)
    }

    /// The hook went while Argo was still willing to wait, which means the turn it belonged to was
    /// cancelled: Argo's own clock is the shorter of the two, so an expiry can never arrive this
    /// way. The prompt goes without a word (#573).
    private func peerClosed(_ claim: SessionOwnership.ClaimID, peer: Int) {
        guard let waiting = pending[claim], waiting.contains(where: { $0.peer == peer })
        else { return }
        let remaining = waiting.filter { $0.peer != peer }
        pending[claim] = remaining
        cancelClocks(of: waiting.filter { $0.peer == peer })
        ledger.publish(waiting: remaining.map(\.request), for: claim)
    }
}
