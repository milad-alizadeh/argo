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
}
