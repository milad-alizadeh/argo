import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// A feed row read as the shapes the lane draws it with (#382).
///
/// The claim under the whole suite is that the lane is the reading SHRUNK: every ink here is one
/// the row itself is drawn in, and every span is the alignment the row itself takes. A projection
/// that drifts from that turns the lane into a legend, which is exactly what D25 was written
/// against — and nothing on screen tells that drift from a scroll bug.
@Suite("Minimap rows")
struct MinimapRowTests {
    /// A 720pt column, which is the reading measure the feed stops widening at.
    private static let measure: CGFloat = 720

    private static func row(_ content: FeedRow.Content, height: CGFloat = 20) -> MinimapRow {
        MinimapRow(FeedRow(id: 0, content: content), height: height, measure: measure)
    }

    private static func call(churn: FeedCall.Churn?) -> FeedCall {
        FeedCall(
            kind: churn == nil ? .execute : .edit,
            subject: .plain("bun run quality"),
            churn: churn,
            ending: .succeeded,
            evidence: [],
            repeats: 1,
            spend: nil,
        )
    }

    @Test
    func `a paragraph is drawn as one bar per line it was measured at`() {
        let row = Self.row(.message(String(repeating: "word ", count: 200)), height: 100)
        #expect(row.lines == 5)
        #expect(row.runs.map(\.ink) == Array(repeating: .message, count: 5))
        #expect(row.runs.map(\.line) == [0, 1, 2, 3, 4])
    }

    /// The ragged last line is the whole of what makes a block of bars read as prose. The line
    /// COUNT is the row's measured height; only the raggedness comes from the words.
    @Test
    func `the last line of a paragraph is only as full as the words left for it`() {
        let row = Self.row(.message(String(repeating: "x", count: 11)), height: 60)
        #expect(row.runs.dropLast().allSatisfy { $0.span == 0 ... 1 })
        #expect(row.runs.last?.span.upperBound == 0.75)
    }

    /// The one row the feed draws as a shape rather than as lines of text. Drawn here the way it is
    /// read there — one solid block on the trailing edge, however tall the bubble was measured.
    @Test
    func `a prompt is one block on the trailing edge its bubble is drawn on`() {
        let row = Self.row(.prompt("Fix the seam"), height: 80)
        #expect(row.runs.count == 1)
        #expect(row.runs[0].span.upperBound == 1)
        #expect(row.runs[0].span.lowerBound > 0)
    }

    @Test
    func `a prompt too long for its bubble stops where the bubble stops`() {
        let row = Self.row(.prompt(String(repeating: "x", count: 4000)), height: 200)
        #expect(row.runs[0].span.lowerBound == 1 - ArgoFeedRow.bubbleShare)
    }

    @Test
    func `everything the agent said keeps the leading edge the feed draws it on`() {
        let rows = [
            Self.row(.message("said")), Self.row(.thought("reasoned")),
            Self.row(.call(Self.call(churn: nil))),
        ]
        #expect(rows.allSatisfy { $0.runs.allSatisfy { $0.span.lowerBound == 0 } })
    }

    @Test
    func `a prompt carries the words it asked for and nothing else does`() {
        #expect(Self.row(.prompt("Fix the seam")).prompt == "Fix the seam")
        #expect(Self.row(.message("Fixed it")).prompt == nil)
    }

    @Test
    func `a call is one slab however tall the row was measured`() {
        let row = Self.row(.call(Self.call(churn: nil)), height: 80)
        #expect(row.lines == 1)
        #expect(row.runs.map(\.ink) == [.command])
    }

    @Test
    func `a mutation says what it did in the feed's own two inks`() {
        let row = Self.row(.call(Self.call(churn: FeedCall.Churn(added: 30, removed: 10))))
        #expect(row.runs.map(\.ink) == [.command, .added, .removed])
        // Three quarters of the churn was added, so three quarters of the churn's width is. Held
        // to a tolerance because the claim is the proportion, never the last bit of it.
        let added = row.runs[1].span
        let removed = row.runs[2].span
        let share = ArgoMinimapLane.churnShare
        #expect(abs((added.upperBound - added.lowerBound) - share * 0.75) < 0.0001)
        #expect(abs((removed.upperBound - removed.lowerBound) - share * 0.25) < 0.0001)
    }

    @Test
    func `a patch nothing could count is drawn as the call it was`() {
        let row = Self.row(.call(Self.call(churn: FeedCall.Churn(added: 0, removed: 0))))
        #expect(row.runs.map(\.ink) == [.command])
    }

    /// D25's map may never depend on colour alone, so the row waiting on somebody is the one thing
    /// in the lane with a shape of its own: it crosses the whole width where everything else stands
    /// off both edges.
    @Test
    func `a question waiting on somebody crosses the lane`() {
        let ask = FeedAsk(ask: Ask(questions: []), isAnswered: false, answer: nil)
        let row = Self.row(.ask(ask))
        #expect(row.runs.map(\.ink) == [.attention])
        #expect(row.runs.map(\.ink.shape) == [.band])
    }

    @Test
    func `a run of pictures is a frame rather than a fill`() {
        let row = Self.row(.gallery(FeedGallery(shots: [])), height: 120)
        #expect(row.runs.map(\.ink) == [.media])
        #expect(row.runs.map(\.ink.shape) == [.frame])
    }

    @Test
    func `the punctuation between Turns is a rule`() {
        #expect(Self.row(.mark(.compacted)).runs.map(\.ink.shape) == [.rule])
    }

    @Test(arguments: [
        (FeedMark.turnEnded(.endTurn), true),
        (FeedMark.interrupted, true),
        (FeedMark.compacted, false),
        (FeedMark.working, false),
    ])
    func `only a stop reason and an interruption end a Turn`(mark: FeedMark, ends: Bool) {
        #expect(Self.row(.mark(mark)).endsTurn == ends)
    }

    @Test
    func `nothing but a mark can end a Turn`() {
        #expect(Self.row(.message("Done")).endsTurn == false)
    }
}
