import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

// The half of the per-Turn fold's claim that runs over streams written here rather than over
// `TranscriptFixtures.denseTurn` — what the rule refuses to fold, and how a collapsed run of one
// call reconciles with the counts on the line. Its own file because the suite is at its length
// ceiling.

extension FeedWorkFoldTests {
    /// The counts on the line are in CALLS and a collapsed run is one entry in the list, so the
    /// entry carries what it stands for — otherwise `Edited 4` would sit over two names and look
    /// as though it had lost two of them.
    @Test
    func `a collapsed run counts once in the list and its own repeats in the header`() throws {
        let rows = FeedProjection.rows(from: Self.reworked(failing: false))
        let card = try #require(FeedFixture.work(in: rows).first)

        #expect(card.label == "Edited 4 Files")
        #expect(card.steps.map(\.repeats) == [3, 1])
        #expect(card.steps.map(\.repeats).reduce(0, +) == 4)
    }

    /// And the failure count is in ROWS for the same reason turned around: a collapsed run shares
    /// one ending, so the record no longer says which of its three broke.
    @Test
    func `a collapsed run that failed counts one failure, not its repeats`() throws {
        let rows = FeedProjection.rows(from: Self.reworked(failing: true))
        let card = try #require(FeedFixture.work(in: rows).first)

        #expect(card.failures == 1)
        #expect(card.steps.map(\.hasFailed) == [true, false])
    }

    /// Two kinds share the verb `Called`, and a tally per KIND would draw `Called 1 · Called 1`
    /// over what a reader sees as two of the same thing.
    @Test
    func `two kinds that share a verb are counted under it once`() throws {
        let mixed = Self.narrated([
            Made(id: "one", tool: "mcp__linear__list_issues", kind: .mcp, naming: "list"),
            Made(id: "two", tool: "SomeoneElsesTool", kind: .other, naming: "do a thing"),
        ])
        let card = try #require(FeedFixture.work(in: FeedProjection.rows(from: mixed)).first)

        #expect(card.label == "Called 2 Tools")
    }

    /// A delegation is a whole other agent's Turn and carries the rail's join key on its own row,
    /// which a count would take away.
    @Test
    func `a delegation never joins a card`() {
        let handedOver = Self.narrated([
            Made(id: "one", tool: "Task", kind: .delegate, naming: "review the feed"),
            Made(id: "two", tool: "Task", kind: .delegate, naming: "review the lane"),
        ])

        #expect(FeedFixture.work(in: FeedProjection.rows(from: handedOver)).isEmpty)
    }

    /// Looking is the survey's, whose adjacency rule ran first: a read the survey left behind
    /// because it failed must not reappear in a card obeying a different rule.
    @Test
    func `a read the survey left behind never joins a card`() {
        let broken: [TranscriptEvent] = ["a.swift", "b.swift"]
            .flatMap { path -> [TranscriptEvent] in
                [
                    .toolCall(FeedFixture.call(path, tool: "Read", kind: .read, naming: path)),
                    .toolCallOutcome(FeedFixture.failed(path, printing: "No such file")),
                    .message(markdown: "That one is gone."),
                ]
            }
        let rows = FeedProjection.rows(from: broken)

        #expect(FeedFixture.work(in: rows).isEmpty)
        #expect(FeedFixture.surveys(in: rows).isEmpty)
    }

    /// A fold never reaches across a prompt or a stop reason, because those are where the Turns
    /// break — the one rule the overview lane and the feed's Copy turn read.
    @Test
    func `a card never reaches across a Turn boundary`() {
        let cards = FeedFixture.work(in: FeedProjection.rows(
            from: TranscriptFixtures.denseTurn + TranscriptFixtures.denseTurn,
        ))

        #expect(cards.map(\.label) == [
            "Created 3 Files · Edited 3 Files · Deleted 1 File", "Ran 4 Commands",
            "Created 3 Files · Edited 3 Files · Deleted 1 File", "Ran 4 Commands",
        ])
    }

    /// A stream with no prompt and no stop reason in it is still one Turn.
    @Test
    func `a stretch with no boundary at all is one Turn`() {
        let unbounded = Self.narrated([
            Made(id: "one", tool: "Bash", kind: .execute, naming: "swift build"),
            Made(id: "two", tool: "Bash", kind: .execute, naming: "swift test"),
        ])

        #expect(FeedFixture.work(in: FeedProjection.rows(from: unbounded))
            .map(\.label) == ["Ran 2 Commands"])
    }

    /// Calls the agent narrated, one sentence between each — the shape the per-Turn rule exists
    /// for, written small enough that a case can say what it holds.
    /// Three edits of one file back to back — which `FeedCallRun` collapses to one row carrying
    /// `repeats` — and then an edit of another, so the card folds two rows standing for four calls.
    private static func reworked(failing: Bool) -> [TranscriptEvent] {
        (0 ..< 3).flatMap { at -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    "rework-\(at)", tool: "Edit", kind: .edit, naming: "FeedFold.swift",
                )),
                .toolCallOutcome(
                    failing
                        ? FeedFixture.failed("rework-\(at)", printing: "No such file")
                        : TranscriptFixtures.finished(
                            "rework-\(at)", FeedFixture.patch(.modify, added: 1),
                        ),
                ),
            ]
        } + [
            .message(markdown: "And one somewhere else."),
            .toolCall(FeedFixture.call(
                "other",
                tool: "Edit",
                kind: .edit,
                naming: "FeedRow.swift",
            )),
            .toolCallOutcome(TranscriptFixtures.finished(
                "other", FeedFixture.patch(.modify, added: 2),
            )),
        ]
    }

    private struct Made {
        let id: String
        let tool: String
        let kind: ToolCallKind
        let naming: String
    }

    private static func narrated(_ calls: [Made]) -> [TranscriptEvent] {
        calls.flatMap { call -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    call.id, tool: call.tool, kind: call.kind, naming: call.naming,
                )),
                .toolCallOutcome(TranscriptFixtures.printed(call.id, "…")),
                .message(markdown: "And then the agent said something about it."),
            ]
        }
    }
}
