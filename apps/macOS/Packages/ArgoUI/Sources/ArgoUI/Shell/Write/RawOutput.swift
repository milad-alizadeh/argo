import Foundation

/// What a failed operation printed, held whole, plus the one line of it that stands at the control
/// (`cockpit-failure-states-spec.md` §5).
///
/// Both readings come off ONE string, so the line can never say something the output does not.
/// Argo writes no sentence of its own here: git's stderr IS the fix, and `! [rejected] …` is worth
/// less than the `hint:` three lines under it.
struct RawOutput: Equatable, Sendable {
    /// Every character the operation printed, unedited. What the gesture opens.
    let text: String
    /// The output's own first line with anything in it.
    let summary: String

    /// `nil` for an operation that printed nothing — a gesture onto an empty panel is a promise
    /// broken, and a refusal Argo worded itself has no output behind it at all.
    init?(_ text: String) {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        guard let first = lines
            .lazy
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .first(where: { !$0.isEmpty })
        else { return nil }
        self.text = text
        self.summary = first
    }
}
