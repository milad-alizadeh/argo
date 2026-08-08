import ArgoEngine

extension CockpitPresentation.Session {
    /// A turn as a transcript actually writes one, for the surfaces that read a Session rather
    /// than count one.
    ///
    /// Written as ENGINE events, not as rows: a fixture shaped like a row would be a second way
    /// to build one, and the projection that turns a stream into rows is exactly what the feed's
    /// previews and specimen exist to look at. The kinds this feed does not draw yet are in here
    /// on purpose — a specimen where every event is drawable proves nothing about ignoring one.
    static let previewTranscript: [TranscriptEvent] = [
        .prompt(
            text: "Read the anatomy study before you start, then wire the feed's prose through "
                + "the projection seam. Only the prompt, the message and the thought render — "
                + "every other kind arrives with its own ticket, so ignore them cleanly rather "
                + "than drawing a placeholder where a surface has not been decided yet.",
            atMs: 1_733_000_000_000,
        ),
        .thought(
            markdown: "The study puts prose at a reading measure and reasoning in the same "
                + "shape at a quieter ink. Start from the contract, not from the view.",
        ),
        .message(
            markdown: "Read the anatomy study. The feed is one column of prose at a fixed "
                + "measure, and everything else on the deck is chrome around it.",
        ),
        .plan(Plan(entries: [
            PlanEntry(text: "Land the feed's metrics in the contract", status: .inProgress),
            PlanEntry(text: "Draw the three kinds", status: .pending),
        ])),
        .turnEnded(.endTurn),
        .message(
            markdown: "The type ramp already carries the body role, so the feed needs a rhythm "
                + "group rather than a new face: a row inset, a line height, a row gap, and the "
                + "step between a label and the prose under it.",
        ),
        .thought(markdown: "A wide window should get more feed, never a longer line."),
        .prompt(text: "Good. Land the metrics in the contract.", atMs: 1_733_000_050_000),
    ]
        + workedOn
        + [
            .message(
                markdown: "Landed. `ArgoFeedRow` holds all four, no view spells a number, and "
                    + "the build is green again.",
            ),
        ]

    /// The work itself, between the prose: one call of every kind the feed can name, the two
    /// same-named files that make the qualifier appear, and the failure that earns a second line.
    ///
    /// Every one of them is an ENGINE call plus the outcome that answered it, because that pairing
    /// is what the projection does — a fixture written as finished calls would prove nothing about
    /// the half of the reading that finds a result two records later.
    private static let workedOn: [TranscriptEvent] = [
        .toolCall(ToolCall(
            id: "search", name: "Grep", kind: .search, target: "ArgoFeedRow", atMs: nil,
        )),
        .toolCallOutcome(answered("search", .output(OutputEvidence(
            tier: .direct, text: "41 matches across 12 files",
        )))),
        .toolCall(ToolCall(
            id: "read", name: "Read", kind: .read,
            target: "Sources/ArgoUI/VisualContract/ArgoFeedRow.swift", atMs: nil,
        )),
        .toolCallOutcome(answered("read", nil)),
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
        .toolCall(ToolCall(
            id: "test", name: "Bash", kind: .execute,
            target: "swift test --package-path Packages/ArgoUI", atMs: nil,
        )),
        .toolCallOutcome(answered("test", .output(OutputEvidence(
            tier: .direct,
            text: "Test Suite 'All tests' started\n✔ FeedCallTests.everyKindHasItsOwnVerb\n"
                + "Executed 151 tests, with 0 failures in 24.113 seconds\n",
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

    private static func patch(_ change: FileChange, added: Int, removed: Int) -> DiffEvidence {
        DiffEvidence(
            tier: .direct,
            change: change,
            destination: nil,
            added: added,
            removed: removed,
            hunks: [],
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
