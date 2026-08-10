import ArgoEngine

extension CockpitPresentation.Session {
    /// A session at the length a real one reaches: a run of turns, each the shape a turn actually
    /// has — something asked, sometimes some reasoning, a stretch of looking, the work that came
    /// out of it, and usually an answer.
    ///
    /// Generated rather than written out, because what it is evidence about is LENGTH: whether
    /// hundreds of rows stay smooth, whether the reader keeps their place, whether a fold still
    /// reads as a fold at the bottom of a long scroll.
    ///
    /// But generated with the variety a session has, which is the part a template gets wrong. A
    /// fixture of forty identical turns wraps identically forty times and stands every row at the
    /// same height — so it proves nothing about rhythm, and a render of it is a wall rather than
    /// something worth judging. Here the prose is ragged (`LongProse`), some turns answer with one
    /// word and some say nothing at all, the looking runs two to five files deep, and the work is
    /// a different shape every few turns.
    static let longTranscript: [TranscriptEvent] = (0 ..< longTurns).flatMap(turn(_:))

    /// Enough turns to reach the length real sessions on this machine actually reach.
    ///
    /// Counted rather than guessed, which is what #516 found: at 52 turns this fixture projected to
    /// 301 rows, and four genuine Claude Code transcripts out of `~/.claude/projects` projected to
    /// 380, 585, 1168 and 5718. So the fixture every claim about SCALE was checked against was not
    /// a long session at all — it was a short one, and the smoothness question was being asked of a
    /// feed a quarter the size of the one the reader complains about. 200 turns puts it at ~1160
    /// rows: the 38-hour session, which is a long day rather than the worst day.
    private static let longTurns = 200

    private static func turn(_ number: Int) -> [TranscriptEvent] {
        [.prompt(text: LongProse.prompts[number % LongProse.prompts.count], atMs: nil)]
            + reasoned(number)
            + surveyed(number)
            + worked(number)
            + answered(number)
    }

    /// Not every turn reasons out loud, and a feed where every single turn opens in the quieter ink
    /// makes that ink the ground rather than a distinction.
    private static func reasoned(_ number: Int) -> [TranscriptEvent] {
        guard number % 3 != 1 else { return [] }
        return [.thought(markdown: LongProse.thoughts[number % LongProse.thoughts.count])]
    }

    /// The reconnaissance a turn opens with, which the feed folds to one line of counts. Two to
    /// five files deep, so the counts on the folded line differ down the length of the feed rather
    /// than reading as one repeated row.
    ///
    /// The same two same-named files recur, which is what makes a qualifier appear somewhere in
    /// the middle of a long scroll rather than only at the top.
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

    /// What the turn changed. Three shapes in rotation — a turn that only looked, a turn that
    /// edited one file, and a turn that edited one and ran something after it — because a feed
    /// where every turn has the same anatomy hides whether the rhythm survives one that does not.
    private static func worked(_ number: Int) -> [TranscriptEvent] {
        switch number % 4 {
        case 0: []
        case 1: edited(number)
        default: edited(number) + ran(number)
        }
    }

    /// Some turns end without a word. An agent that hands back silently is a real state, and a
    /// fixture where every turn signs off makes the feed's spacing look more regular than it is.
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

    /// Every fourth command fails, so the one row worth seeing recurs down a long scroll rather
    /// than appearing once at a place nobody scrolls to.
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
