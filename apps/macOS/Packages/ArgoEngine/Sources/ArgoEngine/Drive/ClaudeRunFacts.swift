import Foundation

/// How `claude` is put on a model, an effort level and a title of its own once it is already
/// running (#558, #1494).
///
/// All three are the CLI's own slash commands, typed at the prompt exactly as a Turn is — which is
/// why they go through `ClaudeTurn.keystrokes(for:)` rather than growing a second way to reach the
/// same input machinery. The paced Return matters here for the reason it matters for a Turn: `/`
/// opens the command picker inside the input batch, and a Return arriving in that same batch is
/// taken by the picker instead of submitting the line (#682).
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

    /// `/rename <title>` — the CLI's own name for this Session, which is the one Claude's mobile,
    /// desktop and web surfaces read (#1494). Verified against `claude` 2.1.263: the command takes
    /// its name INLINE, so one typed line carries the whole title and no dialog opens, and the
    /// `customTitle` it writes outranks the `ai-title` the CLI's own summariser writes.
    ///
    /// The one line here whose argument is NOT passed through untouched. A model id is a token the
    /// reader picked off a list; a title is a Ticket's words off a code host, or a sentence
    /// somebody
    /// typed, so it can carry a newline or a control character. `/rename` takes its name to the end
    /// of the LINE, which makes a second line a second thing typed at that prompt — with this
    /// line's own Return already on its way behind it. See `oneLine`.
    ///
    /// `nil` where that folding leaves nothing, because `/rename` with no argument is not this
    /// rename with an empty name: it is a different command, and the caller had nothing to say.
    static func renameLine(_ title: String) -> String? {
        let name = oneLine(title)
        guard !name.isEmpty else { return nil }
        return "/rename \(name)"
    }

    /// The title folded onto one line: every control character and every line separator becomes a
    /// space, runs of whitespace collapse to one, and the ends are trimmed.
    ///
    /// Folded rather than deleted, so the words either side of a newline stay two words. Nothing is
    /// truncated: a title long enough to be awkward is still one line, and a cut here would be Argo
    /// deciding how much of a Ticket's words Claude's own apps may show.
    private static func oneLine(_ title: String) -> String {
        let breaks = CharacterSet.controlCharacters.union(.newlines)
        let flattened = String(String.UnicodeScalarView(title.unicodeScalars.map {
            breaks.contains($0) ? " " : $0
        }))
        return flattened.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
