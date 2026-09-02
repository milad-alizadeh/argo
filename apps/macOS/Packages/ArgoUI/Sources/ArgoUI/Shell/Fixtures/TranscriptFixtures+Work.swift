import ArgoEngine

extension TranscriptFixtures {
    /// The work itself: one call of every kind the feed can name, the two same-named files that
    /// make the qualifier appear, the run of three edits the feed collapses, and a failure.
    ///
    /// Each is an ENGINE call plus the outcome that answered it: a fixture written as finished
    /// calls would exercise none of the reading that finds a result two records later.
    static let workedOn: [TranscriptEvent] = surveyed + [
        .toolCall(ToolCall(
            id: "edit", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/FeedView.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("edit", .diff(patch(.modify, added: 8, removed: 3)))),
        .toolCall(ToolCall(
            id: "edit-twin", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Specimen/FeedView.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("edit-twin", .diff(patch(.modify, added: 2, removed: 0)))),
        .toolCall(ToolCall(
            id: "create", name: "Write", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCall.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("create", .diff(patch(.create, added: 39, removed: 0)))),
        // Three edits of one file, back to back: the run the feed collapses to a single line with
        // a count, and three separate patches in the panel behind it.
        .toolCall(ToolCall(
            id: "rework-1", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("rework-1", .diff(patch(.modify, added: 4, removed: 1)))),
        .toolCall(ToolCall(
            id: "rework-2", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("rework-2", .diff(patch(.modify, added: 2, removed: 2)))),
        .toolCall(ToolCall(
            id: "rework-3", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("rework-3", .diff(patch(.modify, added: 1, removed: 6)))),
        .toolCall(ToolCall(
            id: "delete", name: "Write", kind: .edit,
            target: "Sources/ArgoUI/Shell/Deck/LegacyCallRow.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("delete", .diff(patch(.delete, added: 0, removed: 61)))),
        .toolCall(ToolCall(
            id: "move", name: "Edit", kind: .edit,
            target: "Sources/ArgoUI/Shell/ConnectionTint.swift", atMs: nil,
        )),
        .toolCallOutcome(finished("move", .diff(moved(
            to: "Sources/ArgoUI/VisualContract/ConnectionTint.swift",
        )))),
        // Narrated, as a Claude Code record writes a command: the sentence is what the row draws
        // and the command is what the panel opens on, so the fixture carries both.
        .toolCall(ToolCall(
            id: "build", name: "Bash", kind: .execute,
            target: "swift build --package-path Packages/ArgoUI",
            narration: "Build the UI package", atMs: nil,
        )),
        .toolCallOutcome(ToolCallOutcome(
            id: "build",
            resolution: ToolCallOutcome.Resolution(
                status: .failed,
                result: .output(OutputEvidence(
                    tier: .direct,
                    text: "Exit code 65\n\nFeedCallLine.swift:88:7: error: cannot find 'diffAdded' "
                        + "in scope\n** BUILD FAILED **",
                )),
                endedAtMs: nil,
            ),
        )),
        // One read between two commands: a quiet call with a loud one either side never folds, so
        // this is the line that still names the file it looked at.
        .toolCall(ToolCall(
            id: "reread", name: "Read", kind: .read,
            target: "Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift", atMs: nil,
        )),
        .toolCallOutcome(printed(
            "reread",
            "    88\t        .foregroundStyle(argo.color.diff.added)",
        )),
        .toolCall(ToolCall(
            // With a pipeline and NO description, deliberately: the row that still draws the
            // command, as every CLI that narrates nothing produces.
            id: "test", name: "Bash", kind: .execute,
            target: "swift test --package-path Packages/ArgoUI 2>&1 | grep -E 'Test run with'",
            atMs: nil,
        )),
        .toolCallOutcome(printed(
            "test",
            "Test Suite 'All tests' started\n✔ FeedCallTests.everyKindHasItsOwnVerb\n"
                + "Executed 151 tests, with 0 failures in 24.113 seconds\n",
        )),
        // A document the agent wrote. Its patch is the whole file with nothing removed, which is
        // the one shape the panel opens as prose rather than as a patch.
        .toolCall(ToolCall(
            id: "spec", name: "Write", kind: .edit,
            target: "docs/designs/feed-command-legibility-spec.md", atMs: nil,
        )),
        .toolCallOutcome(finished("spec", .diff(DiffEvidence(
            tier: .direct,
            mutation: DiffEvidence.Mutation(change: .create, destination: nil),
            patch: DiffEvidence.Patch(
                added: 12,
                removed: 0,
                hunks: [DiffHunk(oldStart: 0, newStart: 1, lines: specification)],
            ),
        )))),
        // A skill, whose result is the instructions themselves: the row names WHICH one, and the
        // panel behind it is the body the agent went off and read.
        .toolCall(ToolCall(
            id: "skill", name: "Skill", kind: .skill, target: "grill", atMs: nil,
        )),
        .toolCallOutcome(printed(
            "skill",
            "# Grill\n\nInterrogate a claim until it stands or falls.\n\n"
                + "## Process\n\n1. State the claim in one sentence.\n"
                + "2. Name what would have to be true for it to hold.\n"
                + "3. Go and check each one, in the repo and not in your head.\n",
        )),
        .toolCall(ToolCall(
            id: "fetch", name: "WebFetch", kind: .fetch, target: "developer.apple.com", atMs: nil,
        )),
        .toolCallOutcome(printed("fetch", "Adopting Liquid Glass")),
        .toolCall(ToolCall(
            // A delegation narrates itself in the same key a command does, so the row shows the
            // short account and never the brief actually handed over.
            id: "delegate", name: "Task", kind: .delegate, target: "Review the feed",
            narration: "Review the feed", atMs: nil,
        )),
        // Not `finished`, which prices nothing: a landed delegation reports both figures, and the
        // rail draws both.
        .toolCallOutcome(landed("delegate", tokens: 71600, seconds: 96)),
        .toolCall(ToolCall(
            id: "mcp", name: "mcp__linear__list_issues", kind: .mcp, target: nil, atMs: nil,
        )),
        .toolCallOutcome(printed("mcp", "12 issues")),
        .toolCall(ToolCall(
            // With an argument, deliberately: a kind nobody classified is named by its TOOL.
            id: "strange", name: "custom_tool_v2", kind: .other,
            target: "whatever it does", atMs: nil,
        )),
        .toolCallOutcome(finished("strange", nil)),
    ]

    /// Real markdown: the render has to answer whether an outline still reads as one once the
    /// notation stops being drawn.
    private static let specification: [DiffLine] = [
        "# Feed command legibility",
        "",
        "## 4. Read-only commands fold into the survey line",
        "",
        "`FeedCall.Kind.isQuiet` is `true` for `.read` and `.search` only. For `.execute` it",
        "becomes a question about the **command text**.",
        "",
        "- **Cuts, never rewrites** — every character shown is the agent's own.",
        "- **A fold, never a filter.** The count stays on screen.",
        "",
        "```",
        "Read 2 files · Ran 5",
        "```",
    ].map { DiffLine(side: .add, text: $0) }

    /// A patch with a hunk in it: a mutation whose patch nothing could read is a row that does not
    /// open.
    private static func patch(_ change: FileChange, added: Int, removed: Int) -> DiffEvidence {
        DiffEvidence(
            tier: .direct,
            mutation: DiffEvidence.Mutation(change: change, destination: nil),
            patch: DiffEvidence.Patch(
                added: added,
                removed: removed,
                hunks: [DiffHunk(oldStart: 86, newStart: 86, lines: [
                    DiffLine(side: .context, text: "    private var churn: some View {"),
                    DiffLine(side: .del, text: "        .foregroundStyle(diffAdded)"),
                    DiffLine(
                        side: .add,
                        text: "        .foregroundStyle(argo.color.diff.added)",
                    ),
                    DiffLine(side: .context, text: "    }"),
                ])],
            ),
        )
    }

    private static func moved(to destination: String) -> DiffEvidence {
        DiffEvidence(
            tier: .direct,
            mutation: DiffEvidence.Mutation(change: .move, destination: destination),
            patch: DiffEvidence.Patch(added: 0, removed: 0, hunks: []),
        )
    }
}
