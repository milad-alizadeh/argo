import ArgoEngine

extension CockpitPresentation.Session {
    /// A session at the length a real one reaches: a run of turns, each the shape a turn actually
    /// has — something asked, sometimes some reasoning, a stretch of looking, the work that came
    /// out of it, and usually an answer.
    ///
    /// Generated, but with variety: the prose is ragged (`LongProse`), some turns answer with one
    /// word and some say nothing at all, the looking runs two to five files deep, and the work is
    /// a different shape every few turns. Identical turns wrap identically and stand every row at
    /// the same height, which proves nothing about rhythm.
    static let longTranscript: [TranscriptEvent] = (0 ..< longTurns).flatMap(turn(_:))

    /// Enough turns to put hundreds of events through the projection, which is where "a six-hour
    /// run" starts.
    private static let longTurns = 52

    private static func turn(_ number: Int) -> [TranscriptEvent] {
        [.prompt(text: LongProse.prompts[number % LongProse.prompts.count], atMs: nil)]
            + reasoned(number)
            + surveyed(number)
            + worked(number)
            + answered(number)
    }

    /// Not every turn reasons out loud.
    private static func reasoned(_ number: Int) -> [TranscriptEvent] {
        guard number % 3 != 1 else { return [] }
        return [.thought(markdown: LongProse.thoughts[number % LongProse.thoughts.count])]
    }

    /// The reconnaissance a turn opens with, which the feed folds to one line of counts. Two to
    /// five files deep, and the same two same-named files recur so a qualifier appears mid-scroll.
    private static func surveyed(_ number: Int) -> [TranscriptEvent] {
        let looked = [
            "cockpit/Feed.swift",
            "roster/Feed.swift",
            "ArgoFeedRow.swift",
            "DistinguishingLabel.swift",
        ]
        let depth = number % 3 + 2
        return [read("grep-\(number)", tool: "Grep", kind: .search, naming: "argoFeedMeasure")]
            .flatMap(\.self)
            + looked.prefix(depth).enumerated().flatMap { at, path in
                read("read-\(number)-\(at)", tool: "Read", kind: .read, naming: path)
            }
    }

    /// What the turn changed. Three shapes in rotation: a turn that only looked, one that edited
    /// one file, and one that edited and then ran something.
    private static func worked(_ number: Int) -> [TranscriptEvent] {
        switch number % 4 {
        case 0: []
        case 1: edited(number)
        default: edited(number) + ran(number)
        }
    }

    /// Some turns end without a word — an agent that hands back silently is a real state.
    private static func answered(_ number: Int) -> [TranscriptEvent] {
        guard number % 7 != 5 else { return [.turnEnded(.endTurn)] }
        return [
            .message(markdown: LongProse.messages[number % LongProse.messages.count]),
            .turnEnded(.endTurn),
        ]
    }

    private static func edited(_ number: Int) -> [TranscriptEvent] {
        let id = "edit-\(number)"
        return [
            .toolCall(ToolCall(
                id: id,
                name: "Edit",
                kind: .edit,
                target: "Sources/ArgoUI/Shell/Deck/Feed/FeedView\(number).swift",
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
        ]
    }

    /// Every fourth command fails, so the failed row recurs down a long scroll.
    private static func ran(_ number: Int) -> [TranscriptEvent] {
        let id = "run-\(number)"
        let broke = number % 4 == 3
        return [
            .toolCall(ToolCall(
                id: id,
                name: "Bash",
                kind: .execute,
                target: "swift test --filter Feed",
                atMs: nil,
            )),
            .toolCallOutcome(ToolCallOutcome(
                id: id,
                status: broke ? .failed : .completed,
                result: .output(OutputEvidence(
                    tier: .direct,
                    text: broke
                        ? "error: 1 test failed in FeedProjectionTests"
                        : "Test run with 229 tests in 29 suites passed.",
                )),
                endedAtMs: nil,
                usage: nil,
            )),
        ]
    }

    private static func read(
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
