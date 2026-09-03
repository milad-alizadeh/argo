/// How `claude` is put on a model and an effort level once it is already running (#558).
///
/// Both are the CLI's own slash commands, typed at the prompt exactly as a Turn is — which is why
/// they go through `ClaudeTurn.keystrokes(for:)` rather than growing a second way to reach the same
/// input machinery. The paced Return matters here for the reason it matters for a Turn: `/` opens
/// the command picker inside the input batch, and a Return arriving in that same batch is taken by
/// the picker instead of submitting the line (#682).
///
/// Verified against `claude` 2.1.257 on 2026-09-03: `--model <model>` takes an alias (`opus`,
/// `sonnet`, `fable`) or a full name (`claude-fable-5`), and `--effort <level>` documents five
/// levels — `low, medium, high, xhigh, max`. `/model` and `/effort` set the same two mid-session,
/// which is why `BuiltinCuration` vetoes both from the composer's own `/` picker: this owns them.
enum ClaudeRunFacts {
    /// `/model <id>`. The id goes through UNTOUCHED — a name Argo's readable table has never heard
    /// of is exactly the name a newer CLI knows, and normalising it here would be Argo deciding
    /// which models exist.
    static func modelLine(_ modelID: String) -> String {
        "/model \(modelID)"
    }

    /// `/effort <level>`, in the CLI's own word for the rung.
    static func effortLine(_ effort: SessionEffort) -> String {
        "/effort \(ClaudeEffort.value(for: effort))"
    }
}
