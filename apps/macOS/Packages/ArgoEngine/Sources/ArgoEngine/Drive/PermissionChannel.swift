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
    private var sockets: [SessionOwnership.ClaimID: CompanionSocket] = [:]
    private var pending: [SessionOwnership.ClaimID: [Pending]] = [:]
    private var alwaysAllowed: [SessionOwnership.ClaimID: Set<String>] = [:]
    private var issued = 0

    init(
        root: URL,
        onChange: @escaping (SessionOwnership.ClaimID, [PermissionRequest]) -> Void,
    ) {
        self.root = root
        self.onChange = onChange
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

    /// The PTY is gone, so nothing can be waiting and nothing more can ask.
    func withdraw(_ claim: SessionOwnership.ClaimID) {
        sockets.removeValue(forKey: claim)?.close()
        alwaysAllowed.removeValue(forKey: claim)
        guard pending.removeValue(forKey: claim) != nil else { return }
        onChange(claim, [])
    }

    func withdrawAll() {
        for claim in sockets.keys {
            withdraw(claim)
        }
    }

    /// Answer the claim's oldest waiting Permission. `false` when none is waiting — a decision
    /// that raced the hook's own expiry, which the caller reports rather than swallows.
    func decide(_ decision: PermissionDecision, for claim: SessionOwnership.ClaimID) -> Bool {
        guard var waiting = pending[claim], !waiting.isEmpty else { return false }
        let answered = waiting.removeFirst()
        pending[claim] = waiting
        if decision == .allowAlways {
            alwaysAllowed[claim, default: []].insert(answered.request.toolName)
        }
        answered.reply(Self.decisionLine(decision))
        onChange(claim, waiting.map(\.request))
        return true
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
        guard alwaysAllowed[claim, default: []].contains(request.toolName) == false else {
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

    /// The hook's whole reply vocabulary. `allowAlways` travels as a plain allow — the standing
    /// half of it is this end's to remember, not the CLI's.
    private static func decisionLine(_ decision: PermissionDecision) -> String {
        let word = decision == .deny ? "deny" : "allow"
        let reason = decision == .deny ? "Denied in Argo" : "Allowed in Argo"
        return CompanionResponse.line([
            "hookSpecificOutput": [
                "hookEventName": "PreToolUse",
                "permissionDecision": word,
                "permissionDecisionReason": reason,
            ],
        ]) ?? ""
    }
}
