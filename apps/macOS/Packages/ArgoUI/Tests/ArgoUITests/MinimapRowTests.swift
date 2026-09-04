import ArgoEngine
@testable import ArgoUI
import Testing

/// What shape each feed row hands the lane (#382).
///
/// The claim under the suite is that the lane is the reading SHRUNK: every ink here is one the row
/// itself is drawn in, and every piece is one the row itself draws. Drift turns the lane into a
/// legend, which is what D25 was written against.
///
/// The one row with a shape of its own — a question — is `MinimapAskCardTests`.
@MainActor
@Suite("Minimap row shapes")
struct MinimapRowTests {
    /// The pieces a single-line row is drawn as, empty where it is drawn as anything else — so a
    /// claim about them is one expectation rather than a guard and a recorded issue.
    private static func parts(_ content: FeedRow.Content) -> [MinimapLinePart] {
        guard case let .line(parts, _) = MinimapRowFixture.shape(content) else { return [] }
        return parts
    }

    /// The ink of a row drawn as one line, `nil` where it is drawn as anything else.
    private static func lineInk(_ content: FeedRow.Content) -> FeedInk? {
        guard case let .line(_, ink) = MinimapRowFixture.shape(content) else { return nil }
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
        #expect(MinimapRowFixture.shape(.message("said")) == .composed(
            blocks: [.prose(MinimapProseWords(text: "said"))], ink: .message,
        ))
        #expect(MinimapRowFixture.shape(.thought("reasoned")) == .composed(
            blocks: [.prose(MinimapProseWords(text: "reasoned"))], ink: .thought,
        ))
    }

    /// A prompt keeps its own shape, because its lines anchor on the trailing edge where its bubble
    /// is drawn, not the leading edge prose runs from.
    @Test
    func `a prompt is a bubble rather than prose`() {
        #expect(MinimapRowFixture.shape(.prompt(text: "Fix the seam", shots: [])) == .bubble(
            text: "Fix the seam",
            shots: [],
            isFolded: true,
        ))
    }

    @Test
    func `a prompt carries the words it asked for and nothing else does`() {
        #expect(MinimapRowFixture.row(.prompt(text: "Fix the seam", shots: []))
            .prompt == "Fix the seam")
        #expect(MinimapRowFixture.row(.message("Fixed it")).prompt == nil)
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

    @Test
    func `a run of pictures is one frame per shot rather than one over the run`() {
        #expect(MinimapRowFixture.shape(.gallery(FeedGallery(shots: []))) == .shots(widths: []))
        #expect(FeedInk.media.shape == .frame)
    }

    @Test
    func `the punctuation between Turns is a rule`() {
        #expect(MinimapRowFixture.shape(.mark(.compacted)) == .whole(.boundary))
        #expect(FeedInk.boundary.shape == .rule)
    }

    @Test(arguments: [
        (FeedMark.turnEnded, true),
        (FeedMark.interrupted, true),
        (FeedMark.compacted, false),
        (FeedMark.working, false),
    ])
    func `only a stop reason and an interruption end a Turn`(mark: FeedMark, ends: Bool) {
        #expect(MinimapRowFixture.row(.mark(mark)).endsTurn == ends)
    }

    @Test
    func `nothing but a mark can end a Turn`() {
        #expect(MinimapRowFixture.row(.message("Done")).endsTurn == false)
    }
}
