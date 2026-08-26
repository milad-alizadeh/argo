import Foundation

/// The drive port with the adapter chosen per Session (ADR-0024), so no surface that raises an
/// intent has to know which CLI it is talking to.
///
/// The choice reads the thread table and not the Session's `cli` — see `holdsThread(for:)` for why.
@MainActor
struct SessionAdapters: SessionDriver {
    let claude: ClaudeSessionDriver
    let codex: CodexSessionDriver

    /// What the composer draws before anything has been dropped on it. Both adapters take
    /// attachments, by unlike means (ADR-0024), so the answer is the same whichever Session is
    /// live — which is why it can be one value at all. An adapter that took none would make this a
    /// per-Session reading, and the port has no Session to read it for.
    var canAttach: Bool {
        claude.canAttach && codex.canAttach
    }

    /// Routed by Session, unlike `canAttach` above, because here the two adapters DISAGREE: a joint
    /// statement would refuse every claude Session the moment a codex one is reachable (#685).
    func resolvesMentions(for sessionID: String) -> Bool {
        adapter(for: sessionID).resolvesMentions(for: sessionID)
    }

    func canRunCommands(for sessionID: String) -> Bool {
        adapter(for: sessionID).canRunCommands(for: sessionID)
    }

    func send(_ text: String, to sessionID: String) throws {
        try adapter(for: sessionID).send(text, to: sessionID)
    }

    func interrupt(_ sessionID: String) throws {
        try adapter(for: sessionID).interrupt(sessionID)
    }

    func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL] {
        try adapter(for: sessionID).attach(attachments, to: sessionID)
    }

    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws {
        try adapter(for: sessionID).decide(decision, answering: requestID, for: sessionID)
    }

    func answer(
        _ answer: AskAnswer,
        answering askID: String,
        for sessionID: String,
    ) throws {
        try adapter(for: sessionID).answer(answer, answering: askID, for: sessionID)
    }

    func setMode(_ mode: SessionMode, for sessionID: String) async throws {
        try await adapter(for: sessionID).setMode(mode, for: sessionID)
    }

    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        try adapter(for: sessionID).revokeStandingAllow(toolName, for: sessionID)
    }

    private func adapter(for sessionID: String) -> any SessionDriver {
        codex.holdsThread(for: sessionID) ? codex : claude
    }
}

/// The channel half of the seam, routed the same way — by the plan's `cli` where a spawn is being
/// opened, which is DIRECT, and by the thread table everywhere the key is a Session or a claim.
extension SessionAdapters: SessionChannel {
    func host(for plan: AgentSpawnPlan, besides pty: AgentProcessHost) -> AgentProcessHost {
        adapter(for: plan.cli).host(for: plan, besides: pty)
    }

    func open(_ plan: AgentSpawnPlan) {
        adapter(for: plan.cli).open(plan)
    }

    /// Codex first and Claude last, which is the one order this can be asked in: a Codex claim's
    /// bytes are JSON-RPC and belong to its thread, while the Claude adapter's channel IS the
    /// process's own output — it cannot tell a claim of its own from anybody else's, so it takes
    /// whatever is left.
    @discardableResult
    func received(_ chunk: [UInt8], from claim: SessionOwnership.ClaimID) -> Bool {
        guard !codex.received(chunk, from: claim) else { return true }
        return claude.received(chunk, from: claim)
    }

    func resubmit(_ sessionID: String) -> Bool {
        channel(for: sessionID).resubmit(sessionID)
    }

    /// Both, unconditionally: a claim is given up once and every channel it spoke over goes with
    /// it, so this is not the place to work out which one it had.
    func close(_ claim: SessionOwnership.ClaimID) {
        codex.close(claim)
        claude.close(claim)
    }

    private func adapter(for cli: AgentCLI) -> any SessionChannel {
        switch cli {
        case .claude: claude
        case .codex: codex
        }
    }

    private func channel(for sessionID: String) -> any SessionChannel {
        codex.holdsThread(for: sessionID) ? codex : claude
    }
}
