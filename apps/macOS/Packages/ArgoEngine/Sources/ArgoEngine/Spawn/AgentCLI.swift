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

    /// Variables that are true of Argo and false of the agent it starts, per CLI.
    ///
    /// `CLAUDE_CODE_CHILD_SESSION` is set in the environment of a `claude` running under another
    /// one, and a `claude` that reads it writes no transcript of its own. Argo is very often itself
    /// such a child — it is developed from inside a Session — so a spawn that passed this through
    /// would produce the one Session no observation could ever reach: a live PTY with no record
    /// behind it, permanently `unknown` in the roster.
    ///
    /// `OPENAI_API_KEY` is the credential Codex bills to an API key with, and Codex splits its
    /// billing on the credential rather than on the surface (ADR-0024) — so a developer with that
    /// variable exported, which is most of them, is the one way a spawned Session could be metered.
    /// Argo must run on included tokens, so the key does not travel.
    ///
    /// Codex 0.147.0 was observed to keep using the ChatGPT sign-in even with the variable set, so
    /// this is a guard against a version that prefers the key rather than a fix for one that does.
    /// It costs nothing to hold: Argo has no reason to hand Codex a credential at all.
    var scrubbedFromEnvironment: [String] {
        switch self {
        case .claude: ["CLAUDE_CODE_CHILD_SESSION"]
        case .codex: ["OPENAI_API_KEY"]
        }
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

    /// Whether Argo's companion plugin and its permission gate are installed for this CLI. The
    /// bundle speaks Claude Code's plugin format, and Codex raises approvals over its own protocol
    /// rather than through a hook (ADR-0024).
    var takesCompanionPlugin: Bool {
        switch self {
        case .claude: true
        case .codex: false
        }
    }

    /// Whether a seeded prompt goes on argv. Codex's server takes no prompt there — its opening
    /// prompt is the thread's first Turn, which is a message rather than an argument.
    var opensOnArgv: Bool {
        switch self {
        case .claude: true
        case .codex: false
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
    func arguments(resuming chainID: String) -> [String] {
        switch self {
        case .claude: ["--resume", chainID]
        case .codex: []
        }
    }
}
