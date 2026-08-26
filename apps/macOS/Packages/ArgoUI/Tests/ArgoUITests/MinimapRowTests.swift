import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What shape each feed row hands the lane (#382).
///
/// The claim under the suite is that the lane is the reading SHRUNK: every ink here is one the row
/// itself is drawn in, and every piece is one the row itself draws. Drift turns the lane into a
/// legend, which is what D25 was written against.
@MainActor
@Suite("Minimap row shapes")
struct MinimapRowTests {
    private static func row(_ content: FeedRow.Content) -> MinimapRow {
        MinimapRow(FeedRow(id: 0, content: content), height: 20)
    }

    private static func shape(_ content: FeedRow.Content) -> MinimapRowShape {
        row(content).shape
    }

    /// The pieces a single-line row is drawn as, empty where it is drawn as anything else — so a
    /// claim about them is one expectation rather than a guard and a recorded issue.
    private static func parts(_ content: FeedRow.Content) -> [MinimapLinePart] {
        guard case let .line(parts, _) = shape(content) else { return [] }
        return parts
    }

    /// The ink of a row drawn as one line, `nil` where it is drawn as anything else.
    private static func lineInk(_ content: FeedRow.Content) -> FeedInk? {
        guard case let .line(_, ink) = shape(content) else { return nil }
        return ink
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

    /// Prose is always composed, a bare paragraph included: one path through the blocks is what
    /// keeps a heading from being reported at a paragraph's face by a second one.
    @Test
    func `what the agent said is its blocks in the ink the feed says it in`() {
        #expect(Self.shape(.message("said")) == .composed(
            blocks: [.prose(MinimapProseWords(text: "said"))], ink: .message,
        ))
        #expect(Self.shape(.thought("reasoned")) == .composed(
            blocks: [.prose(MinimapProseWords(text: "reasoned"))], ink: .thought,
        ))
    }

    /// A prompt keeps its own shape, because its lines anchor on the trailing edge where its bubble
    /// is drawn, not the leading edge prose runs from.
    @Test
    func `a prompt is a bubble rather than prose`() {
        #expect(Self.shape(.prompt(text: "Fix the seam", shots: [])) == .bubble(
            text: "Fix the seam",
            shots: 0,
            isFolded: true,
        ))
    }

    @Test
    func `a prompt carries the words it asked for and nothing else does`() {
        #expect(Self.row(.prompt(text: "Fix the seam", shots: [])).prompt == "Fix the seam")
        #expect(Self.row(.message("Fixed it")).prompt == nil)
    }

    @Test
    func `a call is the pieces of its sentence, in the order the row sets them`() {
        let parts = Self.parts(.call(Self.call(churn: nil)))
        #expect(Self.lineInk(.call(Self.call(churn: nil))) == .command)
        // The mark's column, the verb, then what it named.
        #expect(parts.count == 3)
        #expect(parts[0].width == ArgoFeedRow.callSymbolWidth)
        #expect(parts[1].text == "Ran")
        #expect(parts[2].text == "bun run quality")
    }

    /// The counts are drawn where the row draws them and in the inks the row gives them — the two
    /// diff roles, in the mono, after what the call named. A fixed slab at the trailing edge said
    /// neither where they were nor how much they were.
    @Test
    func `a mutation says what it did in the feed's own two inks`() {
        let parts = Self.parts(.call(Self.call(churn: FeedCall.Churn(added: 30, removed: 10))))
        #expect(parts.suffix(2).map(\.text) == ["+30", "−10"])
        #expect(parts.suffix(2).map(\.ink) == [.added, .removed])
        #expect(parts.suffix(2).map(\.face.isMachine) == [true, true])
    }

    /// A pure addition draws one count. `−0` is a claim the row never made.
    @Test
    func `a half that did nothing is not drawn`() {
        let parts = Self.parts(.call(Self.call(churn: FeedCall.Churn(added: 4, removed: 0))))
        #expect(parts.map(\.ink).contains(.added))
        #expect(!parts.map(\.ink).contains(.removed))
    }

    @Test
    func `a patch nothing could count is drawn as the call it was`() {
        let silent = FeedCall.Churn(added: 0, removed: 0)
        let parts = Self.parts(.call(Self.call(churn: silent)))
        #expect(!parts.map(\.ink).contains(.added))
        #expect(!parts.map(\.ink).contains(.removed))
    }

    /// A failed row is red in the feed, so it is red here — the counts included. An overview that
    /// drew diff colours beside a red line would read as a change that landed.
    @Test
    func `a call that failed is drawn in the ink the feed fails in`() {
        let failed = Self.call(churn: FeedCall.Churn(added: 3, removed: 1), ending: .failed)
        #expect(Self.lineInk(.call(failed)) == .failure)
        #expect(Self.parts(.call(failed)).allSatisfy { $0.ink == .failure })
    }

    /// D25's map may never depend on colour alone, so the row waiting on somebody is still the one
    /// thing in the lane with a shape of its own — but that shape is now the card the feed draws: a
    /// frame across the whole measure with the words inside it, not a slab of the loudest colour
    /// the app has.
    @Test
    func `a question is the card the feed draws it in`() {
        let asked = Ask(questions: [Ask.Question(
            text: "Which reading?",
            options: Ask.Option.labelled(["One", "Two"]),
        )])
        let ask = FeedAsk(ask: asked, isAnswered: false, answer: nil)
        // The offers carry the numbers the ROW sets them behind, because the lane places them on
        // the same marker grid the row does.
        #expect(Self.shape(.ask(ask)) == .card(MinimapAskCard(
            questions: [MinimapAskCard.Question(
                text: "Which reading?",
                offers: [
                    MinimapAskCard.Offer(marker: "1.", label: "One"),
                    MinimapAskCard.Offer(marker: "2.", label: "Two"),
                ],
            )],
            ink: .attention,
            isRuled: true,
        )))
        let marks = Self.shape(.ask(ask)).marks(across: 400, height: 90)
        // The card's own border, stroked across the whole measure, with the words filled inside it.
        #expect(marks.first == MinimapRowMark(
            y: 0, height: 90, from: 0, to: 400, ink: .attention, shape: .frame,
        ))
        #expect(marks.dropFirst().allSatisfy { $0.drawn == .bar && $0.from > 0 })
        // Three lines, each its marker and its words: the question and the two options under it.
        #expect(marks.count == 7)
    }

    /// The attention ink means *this is waiting on YOU*. On a Session Argo cannot drive it is not,
    /// because nothing done here reaches the agent (#546) — so the lane goes quiet with the row,
    /// rule and all, exactly as an answered question does.
    @Test
    func `a question nobody here can answer takes no attention ink`() {
        let unanswerable = FeedAsk(
            ask: Ask(questions: []),
            isAnswered: false,
            answer: nil,
            offer: FeedAskProjection.Asking(live: nil, isDriveable: false),
        )
        #expect(Self.shape(.ask(unanswerable)) == .card(MinimapAskCard(
            questions: [], ink: .message, isRuled: false,
        )))
    }

    /// The row goes quiet the moment something answers it, and the lane has to go quiet with it — a
    /// lane still amber beside a settled question is the map disagreeing with the reading. It loses
    /// its rule with the colour, because the feed's settled card keeps none either.
    @Test
    func `a question somebody answered stops taking attention ink and its rule`() {
        let settled = FeedAsk(ask: Ask(questions: []), isAnswered: true, answer: "Both")
        #expect(Self.shape(.ask(settled)) == .card(MinimapAskCard(
            questions: [], ink: .message, isRuled: false,
        )))
        #expect(Self.shape(.ask(settled)).marks(across: 400, height: 90).isEmpty)
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
