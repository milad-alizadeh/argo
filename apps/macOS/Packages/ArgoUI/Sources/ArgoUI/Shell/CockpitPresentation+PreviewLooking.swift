import ArgoEngine

extension CockpitPresentation.Session {
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
        .toolCallOutcome(looked("search", "41 matches across 12 files")),
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
            (
                "docs/designs/cockpit-spec.md",
                "The feed is one column of prose at a fixed measure.",
            ),
        ]
        .enumerated()
        .flatMap { position, file -> [TranscriptEvent] in
            [
                .toolCall(ToolCall(
                    id: "look-\(position)", name: "Read", kind: .read,
                    target: file.0, atMs: nil,
                )),
                .toolCallOutcome(looked("look-\(position)", file.1)),
            ]
        }

    private static func looked(_ id: String, _ text: String) -> ToolCallOutcome {
        ToolCallOutcome(
            id: id,
            status: .completed,
            result: .output(OutputEvidence(tier: .direct, text: text)),
            endedAtMs: nil,
            usage: nil,
        )
    }
}
