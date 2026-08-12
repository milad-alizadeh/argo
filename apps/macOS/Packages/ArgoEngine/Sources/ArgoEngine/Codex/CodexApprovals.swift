import Foundation

/// The approvals one Codex thread is holding, and the clock Argo keeps over each (#549, ADR-0024).
///
/// The `codex` counterpart of `PermissionChannel`, and deliberately the same shape: a prompt from
/// either CLI is one `PermissionRequest` under one claim, so the cockpit cannot tell them apart.
/// What differs is only the transport — a JSON-RPC response by id, rather than a line down a
/// socket.
///
/// **The deadline here is Argo's, and it has to be.** The server keeps no clock of its own: an
/// approval nobody answers holds the Turn open for ever (openai/codex#11816, and a 60-second hold
/// sat open in the #547 spike). So the clock runs out, Argo answers `decline` itself, and the
/// Session publishes a `PermissionExpiry` — DIRECT, Argo's own act from end to end.
///
/// Nothing here auto-allows at the top rung, unlike the `claude` gate. On this surface `Auto` is
/// `approvalPolicy: "never"` on the Turn itself (`CodexStance`), so the server never asks and there
/// is nothing to answer for.
@MainActor
final class CodexApprovals {
    private struct Pending {
        let request: PermissionRequest
        /// The JSON-RPC id the answer must name. The server matches on it and on nothing else.
        let rpcID: Int
        /// The server's item this asks about, kept so the Turn ending can tell a diff still under a
        /// live prompt from one nothing is reading.
        let itemID: String?
        /// Argo's own clock for this one call, cancelled by every other way it can end.
        let clock: Task<Void, Never>
    }

    private let patience: PermissionPatience
    private let publish: @MainActor (GateReadings) -> Void
    private let write: @MainActor (String?) -> Void
    private var pending: [Pending] = []
    private var readings = GateReadings()
    /// The diff of each file-change item this Turn, by `itemId`. Held here because the approval
    /// request for one carries no diff at all — the content travels on the item's own
    /// notifications, and this is the only place a patch prompt's target can come from.
    private var patches: [String: [CodexFileChange]] = [:]
    private var issued = 0

    init(
        patience: PermissionPatience,
        publish: @escaping @MainActor (GateReadings) -> Void,
        write: @escaping @MainActor (String?) -> Void,
    ) {
        self.patience = patience
        self.publish = publish
        self.write = write
    }

    /// The server asked for one. A tool the user has already ruled on for this Session is accepted
    /// where it arrives and never becomes a prompt, exactly as on the `claude` gate.
    func raise(_ asked: CodexApprovalAsk) {
        guard !allows(asked.ask.toolName) else {
            return answer(asked.rpcID, .allow)
        }
        issued += 1
        let itemID = CodexAsk.itemID(asked.params)
        let request = asked.ask.permission(
            id: "codex-permission-\(issued)",
            params: asked.params,
            changes: itemID.flatMap { patches[$0] } ?? [],
        )
        pending.append(Pending(
            request: request,
            rpcID: asked.rpcID,
            itemID: itemID,
            clock: arm(request.id),
        ))
        republish()
    }

    /// What one file-change item would write, off a notification that carries it. Recorded whether
    /// or not that item ever asks: the diff arrives BEFORE the approval on this surface, so a table
    /// filled only on demand would have nothing in it by the time the prompt was raised.
    func noted(patch itemID: String, changes: [JSONValue]) {
        patches[itemID] = changes.compactMap(CodexFileChange.init)
    }

    /// The Turn is over, so its items are. Nothing pending is touched — an approval outliving its
    /// Turn is the server's business, and dropping the diff under a live prompt would blank a
    /// target the user is reading.
    func completedTurn() {
        let live = Set(pending.compactMap(\.itemID))
        patches = patches.filter { live.contains($0.key) }
    }

    /// Answer the named waiting Permission. `false` when that request is no longer waiting — a
    /// decision that raced Argo's own clock, which the caller reports rather than swallows.
    func decide(_ decision: PermissionDecision, answering requestID: String) -> Bool {
        guard let answered = take(requestID) else { return false }
        answer(answered.rpcID, decision)
        guard decision == .allowAlways else {
            republish()
            return true
        }
        stand(answered.request.toolName)
        return true
    }

    /// Take a standing allow back (#572). Nothing in flight is disturbed: the next call to that
    /// tool simply asks again. `false` where there was no grant.
    func revoke(_ toolName: String) -> Bool {
        guard allows(toolName) else { return false }
        readings.standing = readings.standing.filter { $0.toolName != toolName }
        republish()
        return true
    }

    /// The process is gone, so nothing can be waiting and no answer can reach the server. The
    /// clocks are cancelled first: a day-long `Task` sleeping against a dead thread is a leak.
    ///
    /// The waiting calls go in silence, as the `claude` gate's do — nothing was refused, and there
    /// is nothing left to read a refusal.
    func close() {
        cancel(pending)
        pending = []
        patches = [:]
        readings = GateReadings()
    }

    private func allows(_ toolName: String) -> Bool {
        readings.standing.contains { $0.toolName == toolName }
    }

    /// Record the grant, and let every OTHER call to that tool already waiting through on the same
    /// word — a prompt still sitting there for a tool that has stopped asking would be the grant
    /// not meaning what its label says.
    private func stand(_ toolName: String) {
        readings.standing.append(StandingAllow(toolName: toolName))
        let covered = pending.filter { $0.request.toolName == toolName }
        pending = pending.filter { $0.request.toolName != toolName }
        cancel(covered)
        for one in covered {
            answer(one.rpcID, .allow)
        }
        republish()
    }

    /// Argo's clock for one call: it runs out, Argo refuses the call itself, and the Session says
    /// so.
    private func arm(_ requestID: String) -> Task<Void, Never> {
        Task { [weak self, patience] in
            try? await Task.sleep(for: .seconds(patience.seconds))
            guard !Task.isCancelled else { return }
            self?.expire(requestID)
        }
    }

    private func expire(_ requestID: String) {
        guard let gone = take(requestID) else { return }
        write(CodexRPC.result(id: gone.rpcID, ["decision": .string(CodexAsk.expired)]))
        readings.expiries.append(PermissionExpiry(gone.request))
        republish()
    }

    /// Lift one call off the pile and stop its clock. Every way a Permission ends that is not its
    /// clock firing stops that clock first — an answered call whose timer still ran would report an
    /// expiry over a decision somebody made.
    private func take(_ requestID: String) -> Pending? {
        guard let index = pending.firstIndex(where: { $0.request.id == requestID }) else {
            return nil
        }
        let taken = pending.remove(at: index)
        cancel([taken])
        return taken
    }

    private func answer(_ rpcID: Int, _ decision: PermissionDecision) {
        write(CodexRPC.result(id: rpcID, ["decision": .string(CodexAsk.word(decision))]))
    }

    private func cancel(_ taken: [Pending]) {
        for one in taken {
            one.clock.cancel()
        }
    }

    private func republish() {
        readings.waiting = pending.map(\.request)
        publish(readings)
    }
}
