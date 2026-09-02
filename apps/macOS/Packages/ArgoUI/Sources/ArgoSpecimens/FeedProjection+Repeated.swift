import ArgoUI

// A reading whose rows say the same words as each other — see `repeatedRows`. Its own file because
// `FeedProjection+Preview.swift` is at its length ceiling.

extension FeedProjection {
    /// A reading whose rows REPEAT, which is what a real one does: the same command run twice, the
    /// same short answer given twice. The state a height store keyed on what a row SAYS collapses
    /// on — one entry for all of them, so a question about the fourth is answered with a fact about
    /// the first and they are drawn over each other (#1100). Rendered by the `feedRepeatedRows`
    /// specimen and held as arithmetic by `FeedHeightPerRowTests`.
    static let repeatedRows = (0 ..< 60).map {
        FeedRow(id: $0, content: .message(repeatedSaid[$0 % repeatedSaid.count]))
    }

    /// Four lines, so a run of them repeats without any two neighbours reading alike.
    private static let repeatedSaid = [
        "Done.",
        "Green.",
        "Read what is there before changing any of it.",
        "Done.",
    ]
}
