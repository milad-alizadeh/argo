import ArgoEngine
import ArgoFixtures
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a reading says about spend, which is now nothing at the foot of it (#1248). The Session's
/// own figure is the deck header's to state, and the rail's chips state the one grain the header
/// does not. The marks a reading is punctuated by are `FeedPunctuationTests`.
@Suite("What a reading says a Session spent")
struct FeedSpendTests {
    /// The row this replaced read `session · 3.8k tokens spent · 769k cached` at the foot of every
    /// reading, one scroll under the header saying the same two numbers.
    @Test
    func `no reading states the session's spend at its foot`() {
        let rows = FeedProjection.rows(from: delegations() + [
            .usage(Usage(
                inputTokens: 1000,
                outputTokens: 30,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            )),
        ])

        #expect(FeedFixture.marks(in: rows).isEmpty)
    }

    /// A record read in two ends reported a figure on each. Neither reaches the feed, and nothing
    /// sums them — the misleading total the seam used to withhold cannot be drawn at all now.
    @Test
    func `a bounded reading states no spend either, and the seam still shows`() {
        let marks = FeedFixture.marks(in: FeedProjection.previewExcerptedRows)

        #expect(marks.contains(.excerpted))
        #expect(!marks.contains { $0.words?.contains("tokens spent") == true })
    }

    /// The number is not lost, only stated once. This fails the moment the header stops saying it,
    /// which is the thing that would leave a reader with nowhere to find it.
    @Test
    func `the deck header states the figure the feed no longer repeats`() throws {
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

        #expect(header.hasPrefix("1.83M tokens spent · 28.1M cached"))
    }

    /// A chip states the fresh half alone, labelled — never the billed sum. A Subagent's reported
    /// usage is itself a roll-up over its own requests, so it carries the same re-read (#1177).
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
