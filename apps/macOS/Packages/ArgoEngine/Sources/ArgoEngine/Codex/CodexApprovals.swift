import Foundation

/// The approvals one Codex thread is holding, and the clock Argo keeps over each (#549, ADR-0024).
///
/// The `codex` counterpart of `PermissionChannel`: a prompt from either CLI is one
/// `PermissionRequest` under one claim, and only the transport differs — a JSON-RPC response by id
/// rather than a line down a socket. The waiting itself is the same `PatienceTable` both `claude`
/// gates use (#750), keyed by nothing, because a Codex thread's scope is itself.
///
/// The server keeps no clock of its own, so an approval nobody answers holds the Turn open for ever
/// (openai/codex#11816, and a 60-second hold sat open in the #547 spike). The deadline is therefore
/// Argo's: it runs out, Argo answers `decline` itself, and the Session publishes a
/// `PermissionExpiry`.
///
/// What is this gate's OWN, above the table, is the standing allow and the patch join. Nothing here
/// auto-allows at the top rung, unlike the `claude` gate: on this surface `Auto` is
/// `approvalPolicy: "never"` on the Turn itself (`CodexStance`), so the server never asks.
@MainActor
final class CodexApprovals {
    private struct Pending: Patient {
        let request: PermissionRequest
        /// The JSON-RPC id the answer must name. The server matches on it and on nothing else.
        let rpcID: Int
        /// The server's item this asks about, kept so the Turn ending can tell a diff still under a
        /// live prompt from one nothing is reading.
        let itemID: String?

        var patienceID: String {
            request.id
        }

        /// The server blocks on an RPC id, not on a connection: there is no peer here to watch go.
        var patiencePeer: Int? {
            nil
        }
    }

    private let publish: @MainActor (GateReadings) -> Void
    private let write: @MainActor (String) -> Bool
    private let table: PatienceTable<SolePile, Pending>
    private var readings = GateReadings()
    /// The diff of each file-change item this Turn, by `itemId`. Held here because the approval
    /// request for one carries no diff at all — the content travels on the item's own
    /// notifications, and this is the only place a patch prompt's target can come from.
    private var patches: [String: [CodexFileChange]] = [:]

    init(
        patience: PermissionPatience,
        publish: @escaping @MainActor (GateReadings) -> Void,
        write: @escaping @MainActor (String) -> Bool,
    ) {
        self.publish = publish
        self.write = write
        self.table = PatienceTable(patience: patience, prefix: "codex-permission")
        table.changed = { [weak self] _, waiting in
            self?.republish(waiting)
        }
        table.expired = { [weak self] _, gone in
            self?.refuse(gone)
        }
    }

    /// The server asked for one. A tool the user has already ruled on for this Session is accepted
    /// where it arrives and never becomes a prompt, exactly as on the `claude` gate.
    func raise(_ asked: CodexApprovalAsk) {
        guard !allows(asked.ask.toolName) else {
            return answer(asked.rpcID, .allow)
        }
        let itemID = CodexAsk.itemID(asked.params)
        let changes = itemID.flatMap { patches[$0] } ?? []
        table.raise(for: .sole) {
            Pending(
                request: asked.ask.permission(id: $0, params: asked.params, changes: changes),
                rpcID: asked.rpcID,
                itemID: itemID,
            )
        }
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
        let live = Set(table.pending(for: .sole).compactMap(\.itemID))
        patches = patches.filter { live.contains($0.key) }
    }

    /// Answer the named waiting Permission. `false` when that request is no longer waiting — a
    /// decision that raced Argo's own clock, which the caller reports rather than swallows.
    func decide(_ decision: PermissionDecision, answering requestID: String) -> Bool {
        guard decision == .allowAlways else {
            return table.answer(requestID, for: .sole) { [weak self] in
                self?.answer($0.rpcID, decision)
            }
        }
        guard let answered = table.waiting(requestID, for: .sole) else { return false }
        stand(answered.request.toolName)
        return true
    }

    /// Take a standing allow back (#572). Nothing in flight is disturbed: the next call to that
    /// tool simply asks again. `false` where there was no grant.
    func revoke(_ toolName: String) -> Bool {
        guard allows(toolName) else { return false }
        readings.standing = readings.standing.filter { $0.toolName != toolName }
        republish(table.pending(for: .sole))
        return true
    }

    /// The process is gone, so nothing can be waiting and no answer can reach the server.
    ///
    /// Published rather than merely dropped, and by this gate rather than by the table: it owns
    /// these readings, so it clears them even where nothing was waiting to be cleared alongside
    /// them. Leaving that to the `claude` channel's withdraw would make a Codex Session's stale
    /// prompt depend on a channel it never spoke over.
    func close() {
        patches = [:]
        readings = GateReadings()
        table.withdraw(.sole)
        publish(readings)
    }

    private func allows(_ toolName: String) -> Bool {
        readings.standing.contains { $0.toolName == toolName }
    }

    /// Record the grant, and let every call to that tool already waiting through on the same word —
    /// a prompt still sitting there for a tool that has stopped asking would be the grant not
    /// meaning what its label says.
    private func stand(_ toolName: String) {
        readings.standing.append(StandingAllow(toolName: toolName))
        let covered = table.answerAll(
            matching: { $0.request.toolName == toolName },
            for: .sole,
            with: { [weak self] in self?.answer($0.rpcID, .allow) },
        )
        // The grant is a reading in its own right, so it is published whether or not the lift
        // covered anything: a table that answered nothing publishes nothing, and a tool that has
        // stopped asking would then never say so.
        guard !covered else { return }
        republish(table.pending(for: .sole))
    }

    /// The table's clock ran out: Argo declines the call itself, and the Session says so.
    private func refuse(_ gone: Pending) {
        reply(gone.rpcID, word: CodexAsk.expired)
        readings.expiries.append(PermissionExpiry(gone.request))
    }

    private func answer(_ rpcID: Int, _ decision: PermissionDecision) {
        reply(rpcID, word: CodexAsk.word(decision))
    }

    /// One JSON-RPC response, by the id the server is blocked on. The two ways it can come to
    /// nothing both mean the answer could never have landed: a decision word that would not encode,
    /// which no `PermissionDecision` produces, and a pipe that has already gone — and a server that
    /// cannot be written to is not one still holding a Turn open.
    private func reply(_ rpcID: Int, word: String) {
        guard let line = CodexRPC.result(id: rpcID, ["decision": .string(word)]) else { return }
        _ = write(line)
    }

    private func republish(_ waiting: [Pending]) {
        readings.waiting = waiting.map(\.request)
        publish(readings)
    }
}
