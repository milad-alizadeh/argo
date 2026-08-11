import Foundation

/// The claude adapter's decide channel (ADR-0024): one Unix socket per claim that the spawned
/// session's `PreToolUse` hook dials, blocks on, and takes its decision back down.
///
/// Every answer it sends is `allow` or `deny`, never `ask` — `ask` would fall through to the TUI's
/// own dialog, which is hidden and has no reader. A hook whose peer goes before an answer was sent
/// is over either way — its turn was cancelled, or the day-long `timeout` finally ran out; this
/// end only has to stop showing a prompt nobody can answer any more.
@MainActor
final class PermissionChannel {
    /// The hook's `timeout`, a day long. A prompt waits for the person, not for a clock: nobody
    /// is watching the cockpit the whole time an agent runs, and a window that answers by expiry
    /// answers on its own. Long enough that the timeout is never the thing that decides, and no
    /// clock is drawn because there is none worth reading.
    nonisolated static let patienceSeconds = 86400

    private struct Pending {
        let request: PermissionRequest
        let peer: Int
        let reply: CompanionConnection.Reply
    }

    private let root: URL
    private let onChange: (SessionOwnership.ClaimID, [PermissionRequest]) -> Void
    private let onStanding: (SessionOwnership.ClaimID, [StandingAllow]) -> Void
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
    private var pending: [SessionOwnership.ClaimID: [Pending]] = [:]
    private var standing = StandingAllowTable()
    private var issued = 0

    init(
        root: URL,
        onChange: @escaping (SessionOwnership.ClaimID, [PermissionRequest]) -> Void,
        onStanding: @escaping (SessionOwnership.ClaimID, [StandingAllow]) -> Void,
    ) {
        self.root = root
        self.onChange = onChange
        self.onStanding = onStanding
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
        guard pending.removeValue(forKey: claim) != nil else { return }
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
        answered.reply(Self.decisionLine(decision))
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
        for covered in waiting where covered.request.toolName == toolName {
            covered.reply(Self.decisionLine(.allow))
        }
        let remaining = waiting.filter { $0.request.toolName != toolName }
        pending[claim] = remaining
        onChange(claim, remaining.map(\.request))
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
            return reply(Self.decisionLine(.deny))
        }
        // The standing allow, applied where the round trip would otherwise start: a tool the user
        // has already ruled on for this Session never becomes a prompt at all. Every other tool
        // takes the per-action path below, untouched.
        guard !standing.allows(request.toolName, for: claim) else {
            return reply(Self.decisionLine(.allow))
        }
        pending[claim, default: []].append(Pending(request: request, peer: peer, reply: reply))
        onChange(claim, pending[claim, default: []].map(\.request))
    }

    /// The hook went — its own timeout denied it, or the turn it belonged to was cancelled.
    /// Either way its questions are over, answered by nobody.
    private func peerClosed(_ claim: SessionOwnership.ClaimID, peer: Int) {
        guard let waiting = pending[claim], waiting.contains(where: { $0.peer == peer })
        else { return }
        let remaining = waiting.filter { $0.peer != peer }
        pending[claim] = remaining
        onChange(claim, remaining.map(\.request))
    }

    /// The hook's whole reply vocabulary — two words, over three answers: what makes `allowAlways`
    /// standing happens on this side of the socket, and the hook is told the same `allow` either
    /// way. `ask` is unrepresentable, here and in the type.
    ///
    /// Switched exhaustively rather than tested against `.deny`, because the reason is the NEXT
    /// variant: `allowAlways` was added to this enum and a `!= .deny` fallback took it silently.
    private static func decisionLine(_ decision: PermissionDecision) -> String {
        let word: String
        let reason: String
        switch decision {
        case .allow, .allowAlways:
            word = "allow"
            reason = "Allowed in Argo"
        case .deny:
            word = "deny"
            reason = "Denied in Argo"
        }
        return CompanionResponse.line([
            "hookSpecificOutput": [
                "hookEventName": "PreToolUse",
                "permissionDecision": word,
                "permissionDecisionReason": reason,
            ],
        ]) ?? ""
    }
}
