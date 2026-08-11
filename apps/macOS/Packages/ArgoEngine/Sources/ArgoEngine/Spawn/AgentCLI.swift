/// Which agent program a spawn runs (CONTEXT.md L2, `Session.cli`).
///
/// One case for now, because one is what the app can honestly launch: the companion channel below
/// speaks Claude Code's plugin format, and a `codex` case that spawned without one would be a
/// managed Session the CONVENTION tier could never reach.
public enum AgentCLI: String, Sendable, CaseIterable {
    case claude

    /// The program name to look up on the user's `PATH`.
    public var command: String {
        rawValue
    }

    /// The flags that start this CLI on one rung of the ladder (ADR-0025). Per-CLI, because the
    /// ladder is Argo's vocabulary and each CLI has its own word for the same boundary.
    ///
    /// It is read at startup and nothing re-reads it, which is why the rung has to be on argv
    /// rather
    /// than written somewhere the CLI is asked to notice.
    func arguments(standingOn mode: SessionMode) -> [String] {
        switch self {
        case .claude: ["--permission-mode", ClaudePermissionMode.value(for: mode)]
        }
    }
}
