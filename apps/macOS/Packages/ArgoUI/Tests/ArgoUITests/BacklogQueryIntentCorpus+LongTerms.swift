@testable import ArgoUI

extension BacklogQueryIntentCorpus {
    /// Six-word-or-more noun phrases that are still terms, never questions — the exact risk
    /// `docs/designs/cockpit-backlog-question.md` names: "a long term reads as a question."
    static let longTerms: [Entry] = [
        Entry(
            query: "session roster fold state for the backlog view",
            expected: .term, group: "awkward: long term",
        ),
        Entry(
            query: "the honesty tier badge on a model answer sheet",
            expected: .term, group: "awkward: long term",
        ),
        Entry(
            query: "atlas engine repository measurement Metal renderer module",
            expected: .term, group: "awkward: long term",
        ),
        Entry(
            query: "quality gate biome swiftlint pre-push hook failure",
            expected: .term, group: "awkward: long term",
        ),
        Entry(
            query: "worktree naming guard and the edit guard scope",
            expected: .term, group: "awkward: long term",
        ),
        // Trailing punctuation other than `?` — the rule's word-count path does not care.
        Entry(
            query: "session roster fold state, unresolved.",
            expected: .term, group: "awkward: long term",
        ),
    ]
}
