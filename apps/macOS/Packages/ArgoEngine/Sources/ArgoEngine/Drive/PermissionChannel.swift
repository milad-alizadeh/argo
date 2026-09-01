import Foundation

/// The claude adapter's decide channel (ADR-0024): one Unix socket per claim that the spawned
/// session's `PreToolUse` hook dials, blocks on, and takes its decision back down.
///
/// Every answer it sends is `allow` or `deny`, never `ask` — `ask` would fall through to the TUI's
/// own dialog, which is hidden and has no reader.
///
/// The waiting itself is a `PatienceTable` (#750). What is this gate's own is the policy above it:
/// the rung a call is judged by, and the standing allows.
///
/// Two ways a prompt ends unanswered, told apart (#573): the table's clock is shorter than the
/// hook's, so a call nobody answers is refused **by Argo** and published as a `PermissionExpiry`,
/// where a peer going before that clock fires went with a cancelled turn and takes its prompt away
/// in silence.
@MainActor
final class PermissionChannel {
    private struct Pending: Patient {
        let request: PermissionRequest
        let reply: CompanionConnection.Reply
        let patiencePeer: Int?

        var patienceID: String {
            request.id
        }
    }

    private let scope: CompanionScope
    /// Written into directly rather than mirrored back through callbacks (#634): all three readings
    /// this channel owns land under one claim key, so there is nothing left for a caller to route.
    private let ledger: ClaimLedger
    /// Where the Session stands, asked per call: a rung is walked mid-Session (#653), so a reading
    /// taken at the grant would be stale by the next one.
    private let rung: (SessionOwnership.ClaimID) -> SessionMode?
    /// The questions half of the same gate (#712), over the same socket. Its own table, because a
    /// Permission and a question are answered by different acts.
    private let asks: AskGate
    private let table: PatienceTable<SessionOwnership.ClaimID, Pending>
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
    private var expired: [SessionOwnership.ClaimID: [PermissionExpiry]] = [:]
    private var standing = StandingAllowTable()

    init(
        scope: CompanionScope,
        patience: PermissionPatience = .default,
        ledger: ClaimLedger,
        rung: @escaping (SessionOwnership.ClaimID) -> SessionMode?,
    ) {
        self.scope = scope
        self.ledger = ledger
        self.rung = rung
        self.asks = AskGate(patience: patience, ledger: ledger)
        self.table = PatienceTable(patience: patience, prefix: "permission")
        table.changed = { claim, waiting in
            ledger.publish(waiting: waiting.map(\.request), for: claim)
        }
        table.expired = { [weak self] claim, gone in
            self?.refuse(gone, for: claim)
        }
    }

    /// Answer one waiting question (#712). `false` when it is no longer waiting, exactly as
    /// `decide` answers for a Permission.
    func answer(
        _ answer: AskAnswer,
        answering askID: String,
        for claim: SessionOwnership.ClaimID,
    )
        -> Bool {
        asks.answer(answer, answering: askID, for: claim)
    }

    /// Open this claim's gate and say where its hook should dial.
    func grant(_ claim: SessionOwnership.ClaimID) throws -> String {
        try scope.createDirectory()
        let path = scope.root.appending(path: "\(claim.value).gate.sock").path
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
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        sockets.removeValue(forKey: claim)?.close()
        asks.withdraw(claim)
        _ = standing.withdraw(claim)
        // The expiries go with the claim: they are what happened to THIS Session.
        expired.removeValue(forKey: claim)
        table.withdraw(claim)
        ledger.withdraw(claim)
    }

    /// Answer the named waiting Permission. `false` when that request is no longer waiting — a
    /// decision that raced the hook's own expiry, which the caller reports rather than swallows.
    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for claim: SessionOwnership.ClaimID,
    )
        -> Bool {
        guard decision == .allowAlways else {
            return table.answer(requestID, for: claim) {
                $0.reply(PermissionReply.line(decision))
            }
        }
        guard let answered = table.waiting(requestID, for: claim) else { return false }
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

    /// Record the grant, and let every call to that tool already waiting through on the same word.
    /// A prompt still sitting there for a tool that has stopped asking would be the grant not
    /// meaning what its label says.
    private func stand(_ toolName: String, for claim: SessionOwnership.ClaimID) {
        if standing.grant(toolName, for: claim) {
            ledger.publish(standing: standing.grants(for: claim), for: claim)
        }
        _ = table.answerAll(
            matching: { $0.request.toolName == toolName },
            for: claim,
            with: { $0.reply(PermissionReply.line(.allow)) },
        )
    }

    /// The table's clock ran out: Argo refuses the call itself and the Session publishes what
    /// happened — DIRECT, Argo's own act from end to end.
    private func refuse(_ gone: Pending, for claim: SessionOwnership.ClaimID) {
        gone.reply(PermissionReply.expired)
        expired[claim, default: []].append(PermissionExpiry(gone.request))
        ledger.publish(expired: expired[claim] ?? [], for: claim)
    }

    private func asked(
        _ claim: SessionOwnership.ClaimID,
        line: String,
        peer: Int,
        reply: @escaping CompanionConnection.Reply,
    ) {
        // A question goes to its own table, and never through the rung or the standing allows
        // below: neither of those answers a question, they only wave a boundary through.
        guard !asks.raise(line, for: claim, peer: peer, reply: reply) else { return }
        guard let draft = PermissionRequest.Draft(line: line) else {
            // Fail closed, and fast: a request Argo could not read is not one the user can be
            // shown, and leaving the hook to its timeout would freeze the turn for nothing.
            return reply(PermissionReply.line(.deny))
        }
        // The top rung asks nothing, Argo's own gate included (ADR-0025, #663). The gate is still
        // INSTALLED there, because a Session walked down from it has to find one already open.
        guard rung(claim) != .auto else {
            return reply(PermissionReply.line(.allow))
        }
        // A tool the user has already ruled on for this Session never becomes a prompt at all.
        guard !standing.allows(draft.toolName, for: claim) else {
            return reply(PermissionReply.line(.allow))
        }
        table.raise(for: claim) {
            Pending(request: draft.minted(as: $0), reply: reply, patiencePeer: peer)
        }
    }

    /// The hook went while Argo was still willing to wait, which means the turn it belonged to was
    /// cancelled: Argo's own clock is the shorter of the two, so an expiry can never arrive this
    /// way. The prompt goes without a word (#573).
    private func peerClosed(_ claim: SessionOwnership.ClaimID, peer: Int) {
        asks.peerClosed(claim, peer: peer)
        table.peerGone(peer, for: claim)
    }
}
