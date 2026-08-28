import Foundation

/// Priority, which GitHub has no field for.
///
/// It is in the read contract every provider owes (`docs/domain/ports.md`), and GitHub Issues
/// carries no priority of its own — a Projects board does, and a board is not the Binding's scope.
/// So this adapter reads the one place a GitHub repository can state one: a **scoped label**, the
/// same `<scope><separator><word>` shape this repo already spells `wayfinder:map` with.
///
/// DERIVED, and never CONVENTION: the tier word for a fact read out of a provider's own data is
/// the observed one, and CONVENTION is reserved for what arrives over the companion channel
/// (`CONTEXT.md` L2 · Honesty tier). Read off a naming habit rather than off a field, which is
/// why an unreadable answer degrades to absent instead of to a middle rung nobody named.
extension GitHubIssue {
    /// The scope a label has to open with to be read as one, folded for case: a tracker spelling it
    /// `Priority: High` means the same thing as `priority/high`.
    private static let scope = "priority"

    /// The separators a scoped label is spelled with. `-` is deliberately absent — `priority-work`
    /// is a plausible topic label, and reading it as the priority `work` would invent a band.
    private static let separators: Set<Character> = [":", "/"]

    /// The provider's own priority word, and `nil` where the repository states none.
    ///
    /// TWO priority labels resolve to `nil` rather than to the first: the ticket says two things,
    /// and picking one would render a DIRECT-looking word the tracker never agreed on
    /// (`CONTEXT.md` L2 · degrade-down).
    var priority: String? {
        let words = labels.compactMap { Self.priorityWord(in: $0.name) }
        return words.count == 1 ? words.first : nil
    }

    /// The label a priority word is written back as. The first separator, because a repository
    /// that already spells it the other way keeps its own spelling: the write clears the label it
    /// read before it adds this one.
    static func priorityLabel(for word: String) -> String {
        "\(scope):\(word)"
    }

    /// The word after the scope, verbatim and in the tracker's own case — Argo neither ranks these
    /// nor recases them. A label that is the bare scope carries no word and is not one.
    static func priorityWord(in label: String) -> String? {
        let name = label.trimmingCharacters(in: .whitespaces)
        guard name.lowercased().hasPrefix(scope) else { return nil }
        var rest = name.dropFirst(scope.count)
        guard let separator = rest.first, separators.contains(separator) else { return nil }
        rest = rest.dropFirst()
        let word = rest.trimmingCharacters(in: .whitespaces)
        return word.isEmpty ? nil : word
    }
}
