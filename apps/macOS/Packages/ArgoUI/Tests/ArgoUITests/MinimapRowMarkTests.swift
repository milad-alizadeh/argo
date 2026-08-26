@testable import ArgoUI
import Foundation
import Testing

/// What a row reports it drew (#382 as amended).
///
/// Every number here is in POINTS of the feed's own coordinates, and every one of them is measured
/// rather than divided: the words go through `ProseMetrics`, which is the same Core Text the row's
/// own `Text` is set by. That is the whole claim — the lane cannot disagree with the reading about
/// a row's shape, because it no longer has an opinion about it.
@MainActor
@Suite("Minimap reported marks")
struct MinimapRowMarkTests {
    /// A 720pt column, the reading measure the feed stops widening at, less its own gutters.
    static let measure: CGFloat = 720 - ArgoFeedRow.inset * 2

    static func marks(_ shape: MinimapRowShape, height: CGFloat = 1000) -> [MinimapRowMark] {
        shape.marks(across: measure, height: height)
    }

    static func prose(_ text: String, ink: FeedInk = .message) -> MinimapRowShape {
        MinimapProseBlock.shape(of: text, ink: ink)
    }

    @Test
    func `a paragraph is one line per line it really wrapped to`() {
        let marks = Self.marks(Self.prose(MinimapText.paragraph))
        #expect(marks.count > 1)
        #expect(marks.allSatisfy { $0.ink == .message })
        // On the line grid, at the face's own box height, each under the one before it.
        #expect(marks.map(\.y) == marks.indices.map { ProseFace.body.y(ofLine: $0) })
        #expect(marks.allSatisfy { $0.height == ProseFace.body.lineBox })
    }

    /// The ragged last line is the whole of what makes a block of bars read as prose — and it is
    /// ragged because the words ran out there, not because a character count divided unevenly.
    @Test
    func `the last line of a paragraph is only as wide as the words that landed on it`() {
        let marks = Self.marks(Self.prose(MinimapText.paragraph))
        #expect(marks.dropLast().allSatisfy { $0.to > Self.measure * 0.8 })
        #expect(marks.last.map { $0.to < marks[0].to } == true)
    }

    /// A one-word paragraph is a short bar. Dividing its character count gave it a FULL one: the
    /// last line is the only ragged one, and a single line is the last line.
    @Test
    func `a one-line paragraph is as wide as its one line`() {
        let marks = Self.marks(Self.prose("Done."))
        #expect(marks.count == 1)
        #expect(marks[0].to > 0)
        #expect(marks[0].to < Self.measure / 4)
    }

    @Test
    func `prose keeps the leading edge the feed draws it on`() {
        #expect(Self.marks(Self.prose(MinimapText.paragraph)).allSatisfy { $0.from == 0 })
    }

    /// A heading is set at its own rung, so it stands taller than the paragraph under it. Reported
    /// at the body's face it claimed a line the row never drew.
    @Test
    func `a heading stands at its own rung rather than the paragraph's`() {
        let marks = Self.marks(Self.prose("# Title\n\nWords under it."))
        #expect(marks.count == 2)
        #expect(marks[0].height == ProseFace.heading(level: 1).lineBox)
        #expect(marks[1].height == ProseFace.body.lineBox)
        // The paragraph starts under the heading, with the feed's own step between the blocks.
        #expect(marks[1].y == marks[0].height + ArgoFeedRow.blockStep)
    }

    /// A list item's words start past its marker column, which is what keeps a wrapped item inside
    /// its own words instead of running back under the bullet.
    @Test
    func `a list item is indented past its own marker`() {
        let marks = Self.marks(Self.prose("- \(MinimapText.paragraph)"))
        let marker = marks[0]
        #expect(marker.to == ArgoFeedRow.markerWidth)
        #expect(marks.dropFirst().allSatisfy {
            $0.from == ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap
        })
    }

    /// A link is inked where the WORDS landed. Read off the source offset instead, `[label](url)`
    /// marked the width of the whole construct at a place the words had long since moved past.
    @Test
    func `a link is inked over the label the reader can see`() {
        let marks = Self.marks(Self.prose("See [the PR](https://a.b) for more."))
        let links = marks.filter { $0.ink == .link }
        #expect(links.count == 1)
        let label = ProseMetrics.width(of: "the PR")
        #expect(abs(links[0].to - links[0].from - label) < 1)
        #expect(links[0].from > 0)
        #expect(links[0].from < marks[0].to)
    }

    /// A fence is one slab where the paragraphs around it are ragged lines, which is what the feed
    /// draws: a raised ground with the code on it.
    @Test
    func `a fence is one slab as tall as its own code`() {
        let marks = Self.marks(Self.prose("```\nlet a = 1\nlet b = 2\n```", ink: .thought))
        #expect(marks.count == 1)
        #expect(marks[0].ink == .thought)
        #expect(marks[0].from == 0)
        #expect(marks[0].to == Self.measure)
        #expect(marks[0].height == ProseFace.machine.height(ofLines: 2) + ArgoSpacing.base * 2)
    }

    /// One bar per line, not one block over the row — a prompt reads as its words, like prose does.
    @Test
    func `a prompt is one line per line, against the trailing edge its bubble is drawn on`() {
        let marks = Self.marks(.bubble(text: MinimapText.paragraph, shots: 0, isFolded: false))
        #expect(marks.count > 1)
        #expect(marks.allSatisfy { $0.ink == .prompt })
        // The ground is its own longest line back from the trailing edge, plus its padding.
        let widest = marks.map(\.to).max() ?? 0
        #expect(abs(widest - (Self.measure - ArgoFeedRow.bubbleInsetX)) < 1)
        #expect(marks.allSatisfy { $0.from == marks[0].from })
        // The words start below the bubble's own breathing room.
        #expect(marks[0].y == ArgoFeedRow.bubbleInsetY)
    }

    /// The fold is the reader's, so the lane draws what they left on screen. Capping an unfolded
    /// prompt is the same mistake as reporting every line of a folded one — the row is measured at
    /// its whole height either way, and the map has to follow the state rather than assume one.
    @Test
    func `a folded prompt draws its first lines and an unfolded one draws them all`() {
        let long = String(repeating: "Read the whole anatomy study before you start. ", count: 14)
        let folded = Self.marks(.bubble(text: long, shots: 0, isFolded: true))
        let whole = Self.marks(.bubble(text: long, shots: 0, isFolded: false))
        #expect(folded.count == ArgoFeedRow.collapsedPromptLines)
        #expect(whole.count > folded.count)
        // The lines they share are the same lines, at the same places.
        #expect(Array(whole.prefix(folded.count)) == folded)
    }

    /// The bubble hugs a short prompt. Held at its ceiling instead, a three-word prompt read as a
    /// bar most of the way across the lane.
    @Test
    func `a short prompt's bubble is as narrow as its words`() {
        let marks = Self.marks(.bubble(text: "Fix it", shots: 0, isFolded: true))
        #expect(marks.count == 1)
        #expect(marks[0].from > Self.measure / 2)
    }

    /// One frame per shot, wrapping where the row's own grid wraps. The count is the whole question
    /// a reader has about a turn that rendered something, so a run of six may not read as one slab.
    @Test
    func `a gallery draws one frame per shot, wrapped as the row wraps them`() {
        // 400pt of column takes two 168pt shots to a line, whatever the contract's gap is.
        let marks = MinimapRowShape.shots(5, across: 400)
        #expect(marks.count == 5)
        #expect(marks.allSatisfy { $0.ink == .media })
        #expect(marks[1].y == marks[0].y)
        #expect(marks[1].from > marks[0].to)
        #expect(marks[2].y > marks[1].y)
        #expect(marks.allSatisfy { $0.height == ArgoFeedRow.shotHeight })
    }

    @Test
    func `a gallery of nothing draws nothing`() {
        #expect(MinimapRowShape.shots(0, across: 400).isEmpty)
    }

    @Test
    func `a row drawn as a whole takes the height the table measured it at`() {
        let marks = Self.marks(.whole(.boundary), height: 9)
        #expect(marks == [MinimapRowMark(
            y: 0, height: 9, from: 0, to: Self.measure, ink: .boundary,
        )])
    }

    @Test
    func `a column not yet laid out reports nothing to draw`() {
        #expect(MinimapRowShape.bubble(MinimapText.paragraph, shots: 0, isFolded: true, across: 0)
            .isEmpty)
        #expect(Self.prose(MinimapText.paragraph).marks(across: 0, height: 40).isEmpty)
    }
}
