import ArgoEngine

extension AgentCLI {
    /// The program the way a person says it, not the way the `PATH` spells it. One table for the
    /// header's fact line and the composer's address line, so the two cannot drift into naming
    /// one agent two ways.
    var readableName: String {
        switch self {
        case .claude: "Claude Code"
        case .codex: "Codex"
        }
    }
}
