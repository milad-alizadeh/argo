import ArgoEngine
@testable import ArgoUI
import Testing

/// The marks between the work: where history was condensed, where a turn ended and why, and what
/// the whole reading cost.
@Suite("Feed punctuation")
struct FeedPunctuationTests {
    @Test
    func `a compaction is a mark in the reading, at the place it happened`() {
        let rows = FeedProjection.rows(from: [
            .message(markdown: "Before."),
            .compaction(atMs: 1000),
            .message(markdown: "After."),
        ])

        #expect(rows.map(\.content) == [
            .message("Before."), .mark(.compacted), .message("After."),
        ])
    }

    /// The host's own word for why, carried through — `unknown` included, since the nearest-looking
    /// guess is what degrade-down forbids.
    @Test(arguments: [
        StopReason.endTurn, .maxTokens, .maxTurnRequests, .refusal, .cancelled, .unknown,
    ])
    func `a turn's end names the reason that ended it`(reason: StopReason) {
        let rows = FeedProjection.rows(from: [.turnEnded(reason)])

        #expect(FeedFixture.marks(in: rows) == [.turnEnded(reason)])
    }

    @Test
    func `an unreadable stop reason reads unknown rather than the nearest guess`() {
        let rows = FeedProjection.rows(from: [.turnEnded(StopReason(reported: "wandered off"))])

        #expect(FeedFixture.marks(in: rows).first?.words == "turn ended · unknown")
    }

    @Test
    func `a turn that simply ended is the rule alone`() {
        #expect(FeedMark.turnEnded(.endTurn).words == nil)
    }

    /// The bound on the silence above: a turn cut off by a ceiling or ended in a refusal is a
    /// different event from one that finished.
    @Test(arguments: [
        StopReason.maxTokens, .maxTurnRequests, .refusal, .cancelled, .unknown,
    ])
    func `an end that was not ordinary keeps its reason on screen`(reason: StopReason) {
        #expect(FeedMark.turnEnded(reason).words == "turn ended · \(reason.rawValue)")
    }

    /// Silence on screen is not silence to a screen reader: the hairline is a shape, and a shape
    /// does not carry.
    @Test
    func `the ordinary end is still spoken`() {
        #expect(FeedMark.turnEnded(.endTurn).spoken == "Turn ended")
    }

    /// The one mark with no chronological position: it is a fact about the whole reading.
    @Test
    func `the session's spend is rolled up at the foot of the reading`() {
        let rows = FeedProjection.rows(from: delegations())

        #expect(FeedFixture.marks(in: rows).last == .spent(Usage(
            inputTokens: 300,
            outputTokens: 70,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
        )))
        #expect(rows.last?.content == .mark(.spent(Usage(
            inputTokens: 300,
            outputTokens: 70,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
        ))))
    }

    /// A Session's cost is what its own turns spent PLUS what it paid other agents to work.
    @Test
    func `the roll-up sums the turns' own spend and the delegated spend alike`() {
        let rows = FeedProjection.rows(from: delegations() + [
            .usage(Usage(
                inputTokens: 1000,
                outputTokens: 30,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            )),
        ])

        #expect(FeedFixture.marks(in: rows).last == .spent(Usage(
            inputTokens: 1300,
            outputTokens: 100,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
        )))
    }

    /// Zero would say the work was free. Nothing said is what actually happened.
    @Test
    func `a session that reported no spend gets no roll-up`() {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.call("one", tool: "Read", kind: .read, naming: "src/token.ts")),
            .toolCallOutcome(TranscriptFixtures.finished("one", nil)),
        ])

        #expect(FeedFixture.marks(in: rows).isEmpty)
    }

    @Test
    func `a spend is drawn with its unit, never as a bare figure`() {
        let mark = FeedMark.spent(Usage(
            inputTokens: 3600,
            outputTokens: 40000,
            cacheReadTokens: 100_000,
            cacheCreationTokens: 0,
        ))

        #expect(mark.words == "session · 143.6K tokens")
    }

    /// The seam a bounded read leaves, at the place the record was cut: a head stitched to a tail
    /// with nothing between them reads as one continuous conversation and is not one (#404 AC4).
    @Test
    func `a record read in two ends says where the middle is missing`() {
        let rows = FeedProjection.rows(from: [
            .message(markdown: "The oldest thing this reading has."),
            .excerpted,
            .message(markdown: "The newest."),
        ])

        #expect(rows.map(\.content) == [
            .message("The oldest thing this reading has."),
            .mark(.excerpted),
            .message("The newest."),
        ])
    }

    @Test
    func `the seam says what is missing rather than the mechanism that missed it`() {
        #expect(FeedMark.excerpted.words == "earlier records not read yet")
        #expect(
            FeedMark.excerpted.spoken == "Earlier records in this Session have not been read yet",
        )
    }

    /// The withholding `HubSession` and the header already make (`SessionHeaderProjection+Spend`),
    /// made here too: a total summed over two ends of a record leaves out whatever the missing
    /// stretch spent, and the foot of the reading renders it as the Session's whole cost.
    @Test
    func `a bounded reading rolls up no spend at all`() {
        let rows = FeedProjection.rows(from: delegations() + [.excerpted])

        let marks = FeedFixture.marks(in: rows)

        #expect(!marks.contains(where: isSpend))
        #expect(marks.contains(.excerpted))
    }

    /// The pair the `feedExcerpted` still is drawn from, held against each other: the SEAM is what
    /// takes the roll-up away, not the fixture happening to report nothing. Without it the same two
    /// ends do carry a figure — and it is the misleading one, being their sum.
    @Test
    func `the seam is what takes the roll-up away, not the fixture`() {
        let bounded = FeedFixture.marks(in: FeedProjection.previewExcerptedRows)
        let whole = FeedFixture.marks(
            in: FeedProjection.rows(from: FeedProjection.previewWholeOfExcerptEvents),
        )

        #expect(!bounded.contains(where: isSpend))
        #expect(whole.contains(where: isSpend))
    }

    /// A run of reads reaching across a turn boundary would put looking from two different turns
    /// behind one count.
    @Test
    func `a mark breaks a run of looking`() {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.call("a", tool: "Read", kind: .read, naming: "one.ts")),
            .toolCall(FeedFixture.call("b", tool: "Read", kind: .read, naming: "two.ts")),
            .turnEnded(.endTurn),
            .toolCall(FeedFixture.call("c", tool: "Read", kind: .read, naming: "three.ts")),
            .toolCall(FeedFixture.call("d", tool: "Read", kind: .read, naming: "four.ts")),
        ])

        #expect(FeedFixture.surveys(in: rows).count == 2)
    }

    private func isSpend(_ mark: FeedMark) -> Bool {
        guard case .spent = mark else { return false }
        return true
    }

    private func delegations() -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call("one", tool: "Task", kind: .delegate, naming: "research")),
            .toolCallOutcome(TranscriptFixtures.spent("one", Usage(
                inputTokens: 100,
                outputTokens: 20,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            ))),
            .toolCall(FeedFixture.call("two", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(TranscriptFixtures.spent("two", Usage(
                inputTokens: 200,
                outputTokens: 50,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            ))),
        ]
    }
}
