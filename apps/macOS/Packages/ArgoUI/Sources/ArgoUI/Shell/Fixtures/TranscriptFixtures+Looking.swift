import ArgoEngine

extension TranscriptFixtures {
    /// The reconnaissance a turn opens with: a grep and five reads, back to back.
    ///
    /// Six calls rather than two, deliberately. A fixture with one read in it renders a fold that
    /// saves one line, which is a render of the mechanism and not of the problem — the reason the
    /// fold exists is that a real turn arrives at the first edit with a screenful of looking above
    /// it, and this is the smallest fixture where the folded line is visibly worth having.
    static let surveyed: [TranscriptEvent] = [
        .toolCall(ToolCall(
            id: "search", name: "Grep", kind: .search, target: "ArgoFeedRow", atMs: nil,
        )),
        .toolCallOutcome(printed("search", "41 matches across 12 files")),
    ]
        + [
            (
                "Sources/ArgoUI/VisualContract/ArgoFeedRow.swift",
                "    10\tpublic enum ArgoFeedRow {\n    11\t    /// The gutter each row is inset "
                    + "from the feed column's edges.\n    12\t    public static let inset: CGFloat "
                    + "= ArgoSpacing.section\n    13\t}",
            ),
            (
                "Sources/ArgoUI/VisualContract/ArgoTypography.swift",
                "    22\tpublic static let body = ArgoTypography(role: .body)",
            ),
            (
                "Sources/ArgoUI/Shell/Deck/Feed/FeedView.swift",
                "    18\t    var body: some View {\n    19\t        ScrollView {",
            ),
            (
                "Sources/ArgoUI/Shell/Deck/Feed/FeedProjection.swift",
                "    13\t    static func rows(from events: [TranscriptEvent]) -> [FeedRow] {",
            ),
            // A read of MARKDOWN, gutter and all, as a host actually answers one. The one file in
            // the survey whose grammar carries almost no ink of its own, and so the one that says
            // whether the panel is drawing the document or the notation.
            (
                "docs/designs/cockpit-spec.md",
                "     1→# Cockpit\n     2→\n     3→The feed is one column of prose at a "
                    + "**fixed measure**.\n     4→\n     5→- Everything else on the deck is "
                    + "chrome around it.\n",
            ),
        ]
        .enumerated()
        .flatMap { position, file -> [TranscriptEvent] in
            [
                .toolCall(ToolCall(
                    id: "look-\(position)", name: "Read", kind: .read,
                    target: file.0, atMs: nil,
                )),
                .toolCallOutcome(printed("look-\(position)", file.1)),
            ]
        }
}
