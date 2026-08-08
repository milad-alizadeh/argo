import ArgoEngine

extension CockpitPresentation.Session {
    /// The work itself, between the prose: one call of every kind the feed can name, the two
    /// same-named files that make the qualifier appear, the run of three edits the feed collapses,
    /// and the failure the whole line goes red for.
    ///
    /// Every one of them is an ENGINE call plus the outcome that answered it, because that pairing
    /// is what the projection does — a fixture written as finished calls would prove nothing about
    /// the half of the reading that finds a result two records later.
    static let workedOn: [TranscriptEvent] = surveyed + [
        .toolCall(ToolCall(
            id: "edit", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/FeedView.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("edit", .diff(patch(.modify, added: 8, removed: 3)))),
        .toolCall(ToolCall(
            id: "edit-twin", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Specimen/FeedView.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("edit-twin", .diff(patch(.modify, added: 2, removed: 0)))),
        .toolCall(ToolCall(
            id: "create", name: "Write", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCall.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("create", .diff(patch(.create, added: 39, removed: 0)))),
        // Three edits of one file, back to back: the run the feed collapses to a single line with
        // a count, and three separate patches in the panel behind it.
        .toolCall(ToolCall(
            id: "rework-1", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("rework-1", .diff(patch(.modify, added: 4, removed: 1)))),
        .toolCall(ToolCall(
            id: "rework-2", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("rework-2", .diff(patch(.modify, added: 2, removed: 2)))),
        .toolCall(ToolCall(
            id: "rework-3", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("rework-3", .diff(patch(.modify, added: 1, removed: 6)))),
        .toolCall(ToolCall(
            id: "delete", name: "Write", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/LegacyCallRow.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("delete", .diff(patch(.delete, added: 0, removed: 61)))),
        .toolCall(ToolCall(
            id: "move", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/ConnectionTint.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("move", .diff(moved(
            to: "Sources/ArgoUI/VisualContract/ConnectionTint.swift",
        )))),
        .toolCall(ToolCall(
            id: "build", name: "Bash", kind: .execute,
            target: "swift build --package-path Packages/ArgoUI", atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "build",
            status: .failed,
            result: .output(OutputEvidence(
                tier: .direct,
                text: "Exit code 65\n\nFeedCallLine.swift:88:7: error: cannot find 'diffAdded' "
                    + "in scope\n** BUILD FAILED **",
            )),
            endedAtMs: nil,
            usage: nil,
        )),
        // One read between two commands: a quiet call with a loud one either side of it never
        // folds, so this is the line that still names the file it looked at. Both states are on
        // screen at once, which is the only way to judge whether the fold reads as the same feed.
        .toolCall(ToolCall(
            id: "reread", name: "Read", kind: .read,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("reread", .output(OutputEvidence(
            tier: .direct,
            text: "    88\t        .foregroundStyle(argo.color.diff.added)",
        )))),
        .toolCall(ToolCall(
            // With a pipeline on it, deliberately: the row shows what RAN and the panel keeps the
            // plumbing, and the render is where that is checked.
            id: "test", name: "Bash", kind: .execute,
            target: "swift test --package-path Packages/ArgoUI 2>&1 | grep -E 'Test run with'",
            atMs: nil,
        )),
        .toolCallOutcome(answered("test", .output(OutputEvidence(
            tier: .direct,
            text: "Test Suite 'All tests' started\n✔ FeedCallTests.everyKindHasItsOwnVerb\n"
                + "Executed 151 tests, with 0 failures in 24.113 seconds\n",
        )))),
        // A skill, whose result is the instructions themselves: the row names WHICH one, and the
        // panel behind it is the body the agent went off and read.
        .toolCall(ToolCall(
            id: "skill", name: "Skill", kind: .skill, target: "grill", atMs: nil,
        )),
        .toolCallOutcome(answered("skill", .output(OutputEvidence(
            tier: .direct,
            text: "# Grill\n\nInterrogate a claim until it stands or falls.\n\n"
                + "## Process\n\n1. State the claim in one sentence.\n"
                + "2. Name what would have to be true for it to hold.\n"
                + "3. Go and check each one, in the repo and not in your head.\n",
        )))),
        .toolCall(ToolCall(
            id: "fetch", name: "WebFetch", kind: .fetch, target: "developer.apple.com", atMs: nil,
        )),
        .toolCallOutcome(answered("fetch", .output(OutputEvidence(
            tier: .direct, text: "Adopting Liquid Glass",
        )))),
        .toolCall(ToolCall(
            id: "delegate", name: "Task", kind: .delegate, target: "review the feed", atMs: nil,
        )),
        .toolCallOutcome(answered("delegate", nil)),
        .toolCall(ToolCall(
            id: "mcp", name: "mcp__linear__list_issues", kind: .mcp, target: nil, atMs: nil,
        )),
        .toolCallOutcome(answered("mcp", .output(OutputEvidence(
            tier: .direct, text: "12 issues",
        )))),
        .toolCall(ToolCall(
            // With an argument, deliberately: a kind nobody classified is named by its TOOL, and
            // the render is where that is checked.
            id: "strange", name: "custom_tool_v2", kind: .other,
            target: "whatever it does", atMs: nil,
        )),
        .toolCallOutcome(answered("strange", nil)),
    ]

    private static func answered(_ id: String, _ result: ToolResult?) -> ToolCallOutcome {
        ToolCallOutcome(id: id, status: .completed, result: result, endedAtMs: nil, usage: nil)
    }

    /// A patch with a hunk in it, because a mutation whose patch nothing could read is a row that
    /// does not open — a fixture with no hunks would render a feed whose edits all refuse to.
    private static func patch(_ change: FileChange, added: Int, removed: Int) -> DiffEvidence {
        DiffEvidence(
            tier: .direct,
            change: change,
            destination: nil,
            added: added,
            removed: removed,
            hunks: [DiffHunk(oldStart: 86, newStart: 86, lines: [
                DiffLine(side: .context, text: "    private var churn: some View {"),
                DiffLine(side: .del, text: "        .foregroundStyle(diffAdded)"),
                DiffLine(side: .add, text: "        .foregroundStyle(argo.color.diff.added)"),
                DiffLine(side: .context, text: "    }"),
            ])],
        )
    }

    private static func moved(to destination: String) -> DiffEvidence {
        DiffEvidence(
            tier: .direct,
            change: .move,
            destination: destination,
            added: 0,
            removed: 0,
            hunks: [],
        )
    }
}
