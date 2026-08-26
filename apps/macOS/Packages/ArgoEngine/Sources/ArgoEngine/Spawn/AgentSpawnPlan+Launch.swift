import Foundation

/// What one plan's CLI is started with. Here rather than in the Hub (#749) because every line of it
/// reads the per-CLI flag bag on `AgentCLI` — argv is the one place the CLIs differ that is a value
/// and not a protocol, so it belongs beside the values.
extension AgentSpawnPlan {
    /// Whether this spawn takes Argo's companion plugin and its permission gate. The bundle speaks
    /// Claude Code's plugin format, and Codex raises approvals over its own protocol (ADR-0024).
    var takesCompanionPlugin: Bool {
        cli.takesCompanionPlugin
    }

    /// The flags for the CLI's surface, then this Session's rung and chain, then the prompt — in
    /// that order, because the prompt is a POSITIONAL and a flag pair arriving after it would be
    /// read as more prompt.
    func launch(
        from launcher: AgentLauncher,
        companion: CompanionInvitation?,
    ) async throws
        -> AgentLaunch {
        let launch = try await launcher.launch(cli: cli, cwd: cwd, companion: companion)
            .adding(cli.surfaceArguments)
            .adding(cli.arguments(standingOn: mode))
            .adding(seed.resuming.map { cli.arguments(resuming: $0.chainID) } ?? [])
            // Never beside `--resume`: that continues a chain whose next file the CLI names itself,
            // and the two flags would be two answers to one question.
            .adding(namedUUID.map { cli.arguments(namingFreshSession: $0) } ?? [])
        // A CLI that opens on a Turn instead takes its prompt when its channel is opened.
        guard cli.opensOnArgv, let opening = seed.opening else { return launch }
        return launch.opening(opening)
    }
}
