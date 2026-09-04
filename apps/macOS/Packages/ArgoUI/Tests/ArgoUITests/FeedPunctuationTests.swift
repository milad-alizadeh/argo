import ArgoEngine
@testable import ArgoUI
import Testing

/// The marks a reading is punctuated by, each read where its event happened: where history was
/// condensed, where a turn ended, and where a bounded read cut the record. Nothing here is about
/// what a reading says a Session spent, which is `FeedSpendTests`.
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

    /// Every reason the host can report, and one it cannot read at all, land on the same mark: the
    /// reason is not news to the reader, and `turn ended · unknown` on a fresh Session says less
    /// than the rule alone (#1248).
    @Test(arguments: [
        StopReason.endTurn, .maxTokens, .maxTurnRequests, .refusal, .cancelled, .unknown,
    ])
    func `a turn's end is one mark, whatever reason ended it`(reason: StopReason) {
        let rows = FeedProjection.rows(from: [.turnEnded(reason)])

        #expect(FeedFixture.marks(in: rows) == [.turnEnded])
    }

    /// The reason the record could not read is dropped here rather than guessed at, exactly as the
    /// readable ones are.
    @Test
    func `an unreadable stop reason draws the same rule as a readable one`() {
        let rows = FeedProjection.rows(from: [.turnEnded(StopReason(reported: "wandered off"))])

        #expect(FeedFixture.marks(in: rows) == [.turnEnded])
    }

    @Test
    func `a turn that ended is the rule alone`() {
        #expect(FeedMark.turnEnded.words == nil)
    }

    /// Silence on screen is not silence to a screen reader: the hairline is a shape, and a shape
    /// does not carry.
    @Test
    func `the end is still spoken`() {
        #expect(FeedMark.turnEnded.spoken == "Turn ended")
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
}
