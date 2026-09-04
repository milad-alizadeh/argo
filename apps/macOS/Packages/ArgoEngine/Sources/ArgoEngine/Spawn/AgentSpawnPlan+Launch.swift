import Foundation

/// What one plan's CLI is started with — argv, and the plugin only some CLIs take.
extension AgentSpawnPlan {
    /// The flags for the CLI's surface, then this Session's rung, its run and its chain, then the
    /// prompt LAST: the prompt is a positional, and a flag pair arriving after it would be read as
    /// more prompt.
    ///
    /// `invite` is asked only of a CLI that takes the companion plugin at all — the bundle speaks
    /// Claude Code's format, and Codex raises approvals over its own protocol (ADR-0024).
    @MainActor
    func launch(
        from launcher: AgentLauncher,
        inviting invite: (SessionOwnership.ClaimID) throws -> CompanionInvitation?,
    ) async throws
        -> AgentLaunch {
        let companion = cli.takesCompanionPlugin ? try invite(claim) : nil
        let launch = try await launcher.launch(cli: cli, cwd: cwd, companion: companion)
            .adding(cli.surfaceArguments)
            .adding(cli.arguments(standingOn: mode))
            .adding(cli.arguments(running: run))
            .adding(seed.resuming.map { cli.arguments(resuming: $0.chainID) } ?? [])
            // Never beside `--resume`: that continues a chain whose next file the CLI names itself,
            // and the two flags would be two answers to one question.
            .adding(namedUUID.map { cli.arguments(namingFreshSession: $0) } ?? [])
        // A CLI that opens on a Turn instead takes its prompt when its channel is opened.
        guard cli.opensOnArgv, let opening = seed.opening else { return launch }
        return launch.opening(opening)
    }
}
