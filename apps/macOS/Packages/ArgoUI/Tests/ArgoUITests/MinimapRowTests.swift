import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What shape each feed row hands the lane (#382).
///
/// The claim under the suite is that the lane is the reading SHRUNK: every ink here is one the row
/// itself is drawn in, and every alignment is the row's own. Drift turns the lane into a legend,
/// which is what D25 was written against.
@Suite("Minimap row shapes")
struct MinimapRowTests {
    private static func row(_ content: FeedRow.Content) -> MinimapRow {
        MinimapRow(FeedRow(id: 0, content: content), height: 20)
    }

    private static func shape(_ content: FeedRow.Content) -> MinimapRowShape {
        row(content).shape
    }

    /// The ink of a row drawn as one sentence, `nil` where it is drawn as anything else — so an
    /// ink is one expectation rather than a guard and a recorded issue.
    private static func sentenceInk(_ content: FeedRow.Content) -> FeedInk? {
        guard case let .sentence(_, ink) = shape(content) else { return nil }
        return ink
    }

    /// What a row drawn as a mutation says it did, `nil` where it is drawn as anything else.
    private static func churn(_ content: FeedRow.Content) -> (added: Int, removed: Int)? {
        guard case let .change(_, added, removed) = shape(content) else { return nil }
        return (added, removed)
    }

    private static func call(churn: FeedCall.Churn?, ending: FeedCall.Ending = .succeeded)
        -> FeedCall {
        FeedCall(
            kind: churn == nil ? .execute : .edit,
            subject: .plain("bun run quality"),
            churn: churn,
            ending: ending,
            evidence: [],
            repeats: 1,
            spend: nil,
        )
    }

    @Test
    func `what the agent said is prose in the rung the feed says it in`() {
        #expect(Self.shape(.message("said")) == .prose(length: 4, ink: .message))
        #expect(Self.shape(.thought("reasoned")) == .prose(length: 8, ink: .thought))
    }

    /// The one row the feed draws as a shape rather than as lines of text: a filled bubble on the
    /// trailing edge.
    @Test
    func `a prompt is a bubble rather than lines of text`() {
        #expect(Self.shape(.prompt("Fix the seam")) == .bubble(length: 12))
    }

    @Test
    func `a prompt carries the words it asked for and nothing else does`() {
        #expect(Self.row(.prompt("Fix the seam")).prompt == "Fix the seam")
        #expect(Self.row(.message("Fixed it")).prompt == nil)
    }

    @Test
    func `a call is one sentence however tall the row was measured`() {
        #expect(Self.sentenceInk(.call(Self.call(churn: nil))) == .command)
    }

    @Test
    func `a mutation carries what it did in lines`() {
        let did = Self.churn(.call(Self.call(churn: FeedCall.Churn(added: 30, removed: 10))))
        #expect(did?.added == 30)
        #expect(did?.removed == 10)
    }

    @Test
    func `a patch nothing could count is drawn as the call it was`() {
        let silent = FeedCall.Churn(added: 0, removed: 0)
        #expect(Self.sentenceInk(.call(Self.call(churn: silent))) != nil)
    }

    /// A failed row is red in the feed, so it is red here. An overview that drew a run of failures
    /// in the same quiet grey as everything else would hide the one thing a reader scans one for.
    @Test
    func `a call that failed is drawn in the ink the feed fails in`() {
        let failed = Self.call(churn: FeedCall.Churn(added: 3, removed: 1), ending: .failed)
        #expect(Self.sentenceInk(.call(failed)) == .failure)
    }

    /// D25's map may never depend on colour alone, so the row waiting on somebody is the one thing
    /// in the lane with a shape of its own: it crosses the whole width where everything else stands
    /// off both edges.
    @Test
    func `a question waiting on somebody crosses the lane`() {
        let ask = FeedAsk(ask: Ask(questions: []), isAnswered: false, answer: nil)
        #expect(Self.shape(.ask(ask)) == .whole(.attention))
        #expect(FeedInk.attention.shape == .band)
    }

    /// The row goes quiet the moment something answers it, and the lane has to go quiet with it —
    /// a lane still amber beside a settled question is the map disagreeing with the reading.
    @Test
    func `a question somebody answered stops taking attention ink`() {
        let settled = FeedAsk(ask: Ask(questions: []), isAnswered: true, answer: "Both")
        #expect(Self.shape(.ask(settled)) == .whole(.message))
    }

    @Test
    func `a run of pictures is one frame per shot rather than one over the run`() {
        #expect(Self.shape(.gallery(FeedGallery(shots: []))) == .shots(count: 0))
        #expect(FeedInk.media.shape == .frame)
    }

    @Test
    func `the punctuation between Turns is a rule`() {
        #expect(Self.shape(.mark(.compacted)) == .whole(.boundary))
        #expect(FeedInk.boundary.shape == .rule)
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
