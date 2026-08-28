/// The ladder in `claude`'s own vocabulary — `--permission-mode` on the way in, the value its
/// records report on the way out (ADR-0025).
///
/// Verified against `claude` 2.1.227 on 2026-08-11, which is where two facts came from that the
/// ADR's paper table did not have: the flag spells the manual rung `manual`, while the transcript
/// still writes `default`, so both have to read; and `shift+tab` cycles a FOUR-value ring that
/// `bypassPermissions` and `dontAsk` are not part of. Re-verified unchanged against 2.1.250 on
/// 2026-08-28 (#629) — the choices, the ring and its order all still hold.
enum ClaudePermissionMode: AgentStanceVocabulary {
    /// What Argo passes to put a Session on this rung. Read Only and Plan answer the same value:
    /// they are one boundary, and no flag carries the intent that separates them.
    static func value(for mode: SessionMode) -> String {
        switch mode {
        case .readOnly, .plan: "plan"
        case .code: "acceptEdits"
        case .auto: "auto"
        }
    }

    /// What an observed value means on the ladder. `plan` reads as Read Only, because the CLI
    /// reports the shared boundary either way. Nearest is judged by what the Session does with
    /// NOBODY answering prompts — so `manual` is Read Only's neighbour, not Code's.
    static func reading(of observed: String) -> SessionModeReading {
        switch observed {
        case "plan": .exactly(.readOnly, cli: observed)
        case "acceptEdits": .exactly(.code, cli: observed)
        case "auto": .exactly(.auto, cli: observed)
        case "manual", "default": .nearly(.readOnly, cli: observed)
        case "bypassPermissions": .nearly(.auto, cli: observed)
        // `dontAsk`'s boundary is a pre-approved allowlist Argo cannot see, and everything outside
        // it fails rather than asking — two Sessions in it can sit at opposite ends of the ladder.
        default: .unknown(cli: observed)
        }
    }

    /// The ring `shift+tab` walks, in the order it walks it. A rung is reached by cycling to it,
    /// which is the only way in: `--permission-mode` is read at startup and nothing re-reads it.
    static let ring = ["auto", "manual", "acceptEdits", "plan"]

    /// How many `shift+tab`s take a Session from `observed` to `target`, and `nil` where the ring
    /// cannot say — an observed value that is not on it (`dontAsk`), or a target that is not. Zero
    /// is a real answer: the Session is already there.
    static func cycles(from observed: String, to target: SessionMode) -> Int? {
        guard let start = ring.firstIndex(of: observed),
              let end = ring.firstIndex(of: value(for: target))
        else { return nil }
        return (end - start + ring.count) % ring.count
    }
}
