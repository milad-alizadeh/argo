/// One CLI's own words for the rungs of the ladder (ADR-0025) — the flag it is put on a rung with,
/// and what a value it reports back means. Per CLI, because a reading that names one CLI's spelling
/// is a false DIRECT the moment a Session of the other kind is drawn (#749).
protocol AgentStanceVocabulary {
    /// The words Argo puts a Session on this rung in. A CLI that spells a boundary with more than
    /// one value states all of them: half a stance is not the whole of it.
    static func value(for mode: SessionMode) -> String

    /// What a value this CLI reported means on the ladder. A word the vocabulary does not know
    /// degrades to `.unknown(cli:)`: an unrecognised boundary is not an approximate one.
    static func reading(of observed: String) -> SessionModeReading
}

extension AgentCLI {
    /// The words this CLI states a stance in. Here rather than beside the CLI's argv flags because
    /// the vocabulary is a drive-side fact — one of the things the two adapters disagree about.
    var stance: any AgentStanceVocabulary.Type {
        switch self {
        case .claude: ClaudePermissionMode.self
        case .codex: CodexStance.self
        }
    }
}

extension AgentCLI? {
    /// `claude`'s, and not a refusal: discovery sweeps `claude` records alone (ADR-0024), so an
    /// OBSERVED stance value can only have come from one — and a `codex` Session's `cli` is DIRECT
    /// off its own spawn, so it is never the case that is unestablished here.
    var stance: any AgentStanceVocabulary.Type {
        self?.stance ?? ClaudePermissionMode.self
    }
}
