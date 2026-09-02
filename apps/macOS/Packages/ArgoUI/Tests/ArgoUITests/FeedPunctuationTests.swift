import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The marks a reading is punctuated by, each read where its event happened: where history was
/// condensed, where a turn ended and why, and where a bounded read cut the record. Nothing here is
/// about the spend rolled up at the foot of the reading, which — the seam's withholding of it
/// included — is `FeedSpendRollUpTests`.
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
