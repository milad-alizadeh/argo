import Foundation

/// What a failed operation printed, held whole, plus the one line of it that stands at the control
/// (`cockpit-failure-states-spec.md` §5).
struct RawOutput: Equatable, Sendable {
    /// Every character the operation printed, unedited. What the gesture opens.
    let text: String
    /// The output's own first line with anything in it.
    let summary: String

    /// `nil` for an operation that printed nothing: there is no output to open.
    init?(_ text: String) {
        // `\r\n` and a bare `\r` are line breaks a provider's body really carries, and either one
        // left in the summary draws as a box or eats the line before it.
        let lines = text.split(whereSeparator: \.isNewline)
        guard let first = lines
            .lazy
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .first(where: { !$0.isEmpty })
        else { return nil }
        self.text = text
        self.summary = first
    }
}
