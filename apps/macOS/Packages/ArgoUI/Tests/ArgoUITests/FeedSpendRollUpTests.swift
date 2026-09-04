import ArgoEngine
import ArgoFixtures
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// Every member here is about the spend rolled up at the foot of a reading: what it sums, how it is
/// drawn, and the seam that takes it away. The marks a reading is punctuated by, each read where
/// its event happened, are `FeedPunctuationTests`.
@Suite("The spend rolled up at the foot of a reading")
struct FeedSpendRollUpTests {
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

        #expect(mark.words == "session · 43.6k tokens spent · 100k cached")
    }

    /// The bug the split was made for (#1177): a Session whose context held 80k read `2.3M tokens`
    /// at the foot, because every request re-reads the whole conversation from cache and the
    /// roll-up counted each of those reads. The fresh half is what a reader means by spend, and it
    /// is stated first.
    @Test
    func `the roll-up never sums the cache into the spend`() {
        let reread = FeedMark.spent(Usage(
            inputTokens: 60000,
            outputTokens: 19900,
            cacheReadTokens: 2_200_000,
            cacheCreationTokens: 20000,
        ))

        #expect(reread.words == "session · 79.9k tokens spent · 2.22M cached")
    }

    /// Pins the SPELLING, which is the half that can drift: both surfaces reach the same
    /// `TokenCount`, and this fails the moment one of them grows its own phrase. That the two
    /// pipelines agree on the NUMBERS is a separate fact, held where they are summed —
    /// `SessionSpendTests` and the roll-up members above.
    @Test
    func `the roll-up spells its spend the way the deck header spells the same one`() throws {
        let usage = Usage(
            inputTokens: 1_800_000,
            outputTokens: 30000,
            cacheReadTokens: 28_100_000,
            cacheCreationTokens: 0,
        )
        let header = try #require(SessionHeaderProjection.spend(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: .managed,
            status: .idle,
            spend: .init(spentTokens: usage.spentTokens, cachedTokens: usage.cachedTokens),
        )))

        #expect(FeedSpend.sessionWords(usage) == "1.83M tokens spent · 28.1M cached")
        #expect(header.hasPrefix("1.83M tokens spent · 28.1M cached"))
    }

    /// A chip states the fresh half alone, labelled — never the billed sum. A Subagent's reported
    /// usage is itself a roll-up over its own requests, so it carries the same re-read.
    @Test
    func `an agent chip states the fresh half, labelled, and never the billed sum`() {
        let usage = Usage(
            inputTokens: 3600,
            outputTokens: 40000,
            cacheReadTokens: 100_000,
            cacheCreationTokens: 0,
        )

        #expect(FeedSpend.agentWords(usage) == "43.6k tokens spent")
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
