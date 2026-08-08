import ArgoEngine

extension CockpitPresentation.Session {
    /// A session at the length a real one reaches: a run of turns, each the shape a turn actually
    /// has — a prompt, some reasoning, a stretch of looking, the work that came out of it, and the
    /// answer.
    ///
    /// Generated rather than written out, and that is the honest form for this one. What it is
    /// evidence about is LENGTH: whether hundreds of rows stay smooth, whether the reader keeps
    /// their place, whether the fold still reads at the bottom of a long scroll. A hand-written
    /// four-hundred-event fixture would be the same claim with four hundred chances to drift.
    ///
    /// Varied per turn on purpose. A feed of one repeated row is a feed where every fold, every
    /// qualifier and every collapsed run fires the same way, which is the one thing a scale
    /// fixture must not be — the rules this surface is made of are all about where a run BREAKS.
    static let longTranscript: [TranscriptEvent] = (0 ..< longTurns).flatMap(turn(_:))

    /// Enough turns to put hundreds of events through the projection, which is where "a six-hour
    /// run" starts. Each turn below is roughly a dozen.
    private static let longTurns = 40

    private static func turn(_ number: Int) -> [TranscriptEvent] {
        [
            .prompt(text: "Take ticket \(400 + number) and land it.", atMs: nil),
            .thought(markdown: "Read what is there before changing any of it."),
        ]
            + surveyed(number)
            + worked(number)
            + [
                .message(
                    markdown: "Landed \(400 + number). The contract suite is green and the "
                        + "measure holds at the narrowest deck.",
                ),
                .turnEnded(.endTurn),
            ]
    }

    /// The reconnaissance a turn opens with, which the feed folds to one line of counts. Long
    /// enough to be a fold and not a run of one, and the same two same-named files in every turn —
    /// so a qualifier appears somewhere in the middle of a long scroll rather than only at the top.
    private static func surveyed(_ number: Int) -> [TranscriptEvent] {
        [
            answered("grep-\(number)", tool: "Grep", kind: .search, naming: "argoFeedMeasure"),
            answered("read-a-\(number)", tool: "Read", kind: .read, naming: "cockpit/Feed.swift"),
            answered("read-b-\(number)", tool: "Read", kind: .read, naming: "roster/Feed.swift"),
            answered("read-c-\(number)", tool: "Read", kind: .read, naming: "ArgoFeedRow.swift"),
        ]
        .flatMap(\.self)
    }

    /// What the turn changed, plus the command it checked itself with. Every fourth command fails,
    /// so a long scroll carries the one row worth seeing at intervals rather than only once.
    private static func worked(_ number: Int) -> [TranscriptEvent] {
        let id = "edit-\(number)"
        let ran = "run-\(number)"
        return [
            .toolCall(ToolCall(
                id: id,
                name: "Edit",
                kind: .edit,
                target: "FeedView\(number).swift",
                atMs: nil,
            )),
            .toolCallOutcome(ToolCallOutcome(
                id: id,
                status: .completed,
                result: .diff(DiffEvidence(
                    tier: .direct,
                    change: .modify,
                    destination: nil,
                    added: number % 9 + 1,
                    removed: number % 4,
                    hunks: [DiffHunk(
                        oldStart: 1,
                        newStart: 1,
                        lines: [DiffLine(side: .add, text: "    .argoFeedMeasure()")],
                    )],
                )),
                endedAtMs: nil,
                usage: nil,
            )),
            .toolCall(ToolCall(
                id: ran,
                name: "Bash",
                kind: .execute,
                target: "swift test --filter Feed",
                atMs: nil,
            )),
            .toolCallOutcome(ToolCallOutcome(
                id: ran,
                status: number % 4 == 3 ? .failed : .completed,
                result: .output(OutputEvidence(
                    tier: .direct,
                    text: number % 4 == 3
                        ? "error: 1 test failed in FeedProjectionTests"
                        : "Test run with 229 tests in 29 suites passed.",
                )),
                endedAtMs: nil,
                usage: nil,
            )),
        ]
    }

    private static func answered(
        _ id: String,
        tool: String,
        kind: ToolCallKind,
        naming target: String,
    )
        -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(id: id, name: tool, kind: kind, target: target, atMs: nil)),
            .toolCallOutcome(ToolCallOutcome(
                id: id,
                status: .completed,
                result: .output(OutputEvidence(tier: .direct, text: "public static let column")),
                endedAtMs: nil,
                usage: nil,
            )),
        ]
    }
}
