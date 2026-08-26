/// One CLI's own words for the rungs of the ladder (ADR-0025) — the flag it is put on a rung with,
/// and what a value it reports back means.
///
/// Beside the drive verbs rather than in a table above them: the rung is Argo's vocabulary and each
/// CLI has its own word for the same boundary, so a reading that names ONE CLI's spelling is a
/// false DIRECT the moment a Session of the other kind is drawn (#749).
///
/// Static requirements, because a vocabulary has nothing to hold: it is a pair of translations, and
/// an instance would be a second thing to keep in step with the CLI it speaks for.
protocol AgentStanceVocabulary {
    /// What Argo passes, or would pass, to put a Session on this rung — and so the value a record
    /// reporting that rung would carry.
    static func value(for mode: SessionMode) -> String

    /// What a value this CLI reported means on the ladder. A word the vocabulary does not know
    /// degrades to `.unknown(cli:)` rather than to the nearest rung: an unrecognised boundary is
    /// not an approximate one.
    static func reading(of observed: String) -> SessionModeReading
}

extension AgentCLI {
    /// The words this CLI states a stance in. Declared here rather than beside the CLI's argv flags
    /// because the vocabulary is a drive-side fact — one of the things the two adapters DISAGREE
    /// about, read through the Session's own `cli`.
    var stance: any AgentStanceVocabulary.Type {
        switch self {
        case .claude: ClaudePermissionMode.self
        case .codex: CodexStance.self
        }
    }
}

extension AgentCLI? {
    /// The vocabulary to read a stance in for a Session whose CLI is not established.
    ///
    /// `claude`'s, and not a refusal: the only stance Argo ever OBSERVES is one a transcript said,
    /// discovery sweeps `claude` records alone (ADR-0024), and a `codex` Session's CLI is DIRECT
    /// off its own spawn. So an unestablished CLI with a stance to read is a `claude` record whose
    /// `cli` has not been filled in yet, and refusing there would blank a footer that was right.
    var stance: any AgentStanceVocabulary.Type {
        self?.stance ?? ClaudePermissionMode.self
    }
}
