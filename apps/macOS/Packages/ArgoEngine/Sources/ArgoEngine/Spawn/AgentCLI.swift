/// Which agent program a spawn runs (CONTEXT.md L2, `Session.cli`).
///
/// Two cases, and they are steered over unlike surfaces: `claude` is the interactive TUI in a PTY
/// Argo never draws, `codex` is `codex app-server` speaking JSON-RPC over pipes (ADR-0024). What is
/// on argv differs with it — Claude takes its rung and its chain as flags, Codex takes both inside
/// the protocol.
public enum AgentCLI: String, Sendable, CaseIterable {
    case claude
    case codex

    /// The program name to look up on the user's `PATH`.
    public var command: String {
        rawValue
    }

    /// The flags that pick the CLI's SURFACE, before anything about this particular Session. Claude
    /// has none — the bare command is the interactive TUI, which is the surface that keeps
    /// subscription billing. Codex names its server explicitly.
    var surfaceArguments: [String] {
        switch self {
        case .claude: []
        case .codex: ["app-server"]
        }
    }

    /// The flags that start this CLI on one rung of the ladder (ADR-0025). Per-CLI, because the
    /// ladder is Argo's vocabulary and each CLI has its own word for the same boundary.
    ///
    /// It is read at startup and nothing re-reads it, which is why the rung has to be on argv
    /// rather
    /// than written somewhere the CLI is asked to notice. Codex has nothing here for the opposite
    /// reason: its rung rides on `thread/start` and again on every `turn/start`, so a Session can
    /// be moved between rungs without a walk (`CodexStance`).
    func arguments(standingOn mode: SessionMode) -> [String] {
        switch self {
        case .claude: ["--permission-mode", ClaudePermissionMode.value(for: mode)]
        case .codex: []
        }
    }

    /// The flags that start this CLI on an EXISTING chain rather than a fresh one (#10). `claude`
    /// continues the chain in a new process and writes a new transcript file whose head leaf points
    /// into the old one, which is what stitches the two halves back into one Session.
    ///
    /// Codex resumes over the protocol (`thread/resume`) rather than on argv, and Argo does not yet
    /// observe a Codex record to name a chain from — so nothing here, and `Hub.resumeSession` stays
    /// on `claude`.
    func arguments(resuming sessionID: String) -> [String] {
        switch self {
        case .claude: ["--resume", sessionID]
        case .codex: []
        }
    }
}
