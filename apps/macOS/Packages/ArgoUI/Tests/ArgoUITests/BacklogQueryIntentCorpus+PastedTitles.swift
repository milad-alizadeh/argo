@testable import ArgoUI

extension BacklogQueryIntentCorpus {
    /// Long noun phrases a reader drops in whole — real ticket titles from this repo's own
    /// history, never a question, and every one of them long enough to cross the six-word floor.
    static let pastedTitles: [Entry] = [
        Entry(
            query: "The field tells a question from a term, and the glyph holds still",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "The macOS gate runs where the Mac is, and the runner that repeated it is gone",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "An answered question folds to its question and the way it went",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "A wait stands on a plinth, and starting is the first one",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "The map draws a flat treemap, its plates named, and the key beside it",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "The engine measures a real repository, and the Atlas draws it",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "Ratchet PRs break main behind in-flight branches",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "The dock terminal is managed-only, external Sessions get no terminal",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "Session status starting is direct and managed-only",
            expected: .term, group: "pasted title",
        ),
        Entry(
            query: "Subagents cannot EnterWorktree, dispatch with git worktree add",
            expected: .term, group: "pasted title",
        ),
    ]
}
