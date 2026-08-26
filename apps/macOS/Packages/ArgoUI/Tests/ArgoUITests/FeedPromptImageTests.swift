import ArgoEngine
@testable import ArgoUI
import SwiftUI
import Testing

/// A picture pasted into a prompt, from the event that carries it to the shape the lane draws
/// (#733). The feed used to show the CLI's `[Image #3]` placeholder and drop the pixels.
@MainActor
@Suite("Prompt pictures in the feed")
struct FeedPromptImageTests {
    /// Real PNG bytes, because half of what a shot does depends on the image decoding at all — a
    /// shot with nothing behind it is not a control, so it is not what the key press cases mean.
    private static func media(_ bytes: String? = FeedFixture.onePixelPNG) -> MediaEvidence {
        MediaEvidence(tier: .direct, mediaType: "image/png", bytes: bytes)
    }

    private static func rows(_ text: String, _ images: [MediaEvidence]) -> [FeedRow] {
        FeedProjection.rows(from: [.prompt(text: text, images: images, atMs: nil)])
    }

    @Test
    func `a prompt's pictures reach its row as shots`() {
        let content = Self.rows("the header sits too low", [Self.media()]).first?.content

        #expect(content == .prompt(
            text: "the header sits too low",
            shots: [FeedShot.pasted(Self.media())],
        ))
    }

    /// The one row of the feed that is not the agent speaking stays that, pictures or not: the
    /// accent wash on a just-sent echo and the two filtered renders all read these.
    @Test
    func `a prompt carrying pictures is still prose the user asked for`() {
        let row = Self.rows("look", [Self.media()]).first

        #expect(row?.kind.isPrompt == true)
        #expect(row?.kind.isProse == true)
        #expect(row?.kind.isCall == false)
        #expect(row?.kind.opensEvidence == false)
    }

    /// An interrupt arrives on the user side of the record too, and it is punctuation rather than
    /// something anyone asked for — so it wins over the picture path as well.
    @Test
    func `an interrupt is still a mark`() {
        let content = Self.rows(ClaudeInterrupt.mark, []).first?.content

        #expect(content == .mark(.interrupted))
    }

    /// A picture pasted into a prompt has no path: the CLI moved the bytes into the record and
    /// named no file, so the shot says what it IS rather than borrowing an address it has not got.
    @Test
    func `a pasted shot names itself rather than a file`() {
        let shot = FeedShot.pasted(Self.media())

        #expect(shot.name == FeedShot.pastedCaption)
        #expect(shot.address == FeedShot.pastedCaption)
        #expect(shot.media.tier == .direct)
    }

    private static func rects(_ text: String, shots: Int) -> [MinimapRowRect] {
        MinimapRowShape.bubble(text: text, shots: shots, isFolded: true)
            .rects(across: MinimapRowRectTests.measure, height: 1000)
    }

    @Test
    func `the lane draws the thumbnails and puts the words under them`() {
        let bare = Self.rects("Fix the seam", shots: 0)
        let carried = Self.rects("Fix the seam", shots: 2)

        // Two frames on top of the one line of words, and the words pushed below them: a prompt
        // that is mostly a thumbnail misreports its own height otherwise.
        #expect(carried.filter { $0.ink == .media }.count == 2)
        #expect(carried.filter { $0.ink == .prompt }.count == bare.count)
        let words = carried.last { $0.ink == .prompt }
        #expect((words?.y ?? 0) > (bare.last?.y ?? 0))
    }

    /// The bubble's ground is as wide as its widest thing. Held to the words alone, two thumbnails
    /// drew off the trailing edge of the lane.
    @Test
    func `the bubble is as wide as its pictures where they are wider than its words`() {
        let rects = Self.rects("Fix it", shots: 2)

        let edge = MinimapRowRectTests.measure - ArgoFeedRow.bubbleInsetX
        #expect(rects.allSatisfy { $0.to <= edge + 1 })
        #expect(rects.filter { $0.ink == .media }.map(\.from).min() == rects.map(\.from).min())
    }

    /// The pictures ride the bubble's trailing edge, the way the row stacks them. Reported from the
    /// leading edge instead, a long prompt's thumbnail drew on the wrong side of its own bubble.
    @Test
    func `the thumbnails sit against the trailing edge a long prompt's bubble is drawn on`() {
        let rects = Self.rects(String(repeating: "Fold me. ", count: 20), shots: 1)

        let pictures = rects.filter { $0.ink == .media }
        #expect(pictures.map(\.to).max() == rects.map(\.to).max())
        #expect((pictures.map(\.from).min() ?? 0) > (rects.map(\.from).min() ?? 0))
    }

    /// What the two writes a press can make land in, so a case can say which one it was.
    private final class Pressed {
        var lit: FeedShot?
        var isExpanded = false
    }

    private static func selection(writing pressed: Pressed) -> FeedRowSelection {
        let focus = FocusState<FeedFocus?>()
        return FeedRowSelection(
            open: .constant(nil),
            step: .constant(nil),
            lit: Binding(get: { pressed.lit }, set: { pressed.lit = $0 }),
            focus: focus.projectedValue,
        )
    }

    private static func pressing(_ content: FeedRow.Content) -> Pressed {
        let pressed = Pressed()
        FeedRow(id: 0, content: content).activate(
            selection: selection(writing: pressed),
            isExpanded: Binding(get: { pressed.isExpanded }, set: { pressed.isExpanded = $0 }),
        )
        return pressed
    }

    /// A prompt that is only a picture has no fold for the key to work, and a row that swallows the
    /// key while doing nothing takes it away from the feed, which is where scrolling lives.
    @Test
    func `a wordless prompt opens its picture on Return`() {
        let shot = FeedShot.pasted(Self.media())
        let pressed = Self.pressing(.prompt(text: "", shots: [shot]))

        #expect(pressed.lit == shot)
        #expect(!pressed.isExpanded)
    }

    /// Nothing to fold and nothing to open. Taking the key here takes it from the feed, which is
    /// where scrolling lives — so the row lets it through rather than answering with a no-op.
    @Test
    func `a wordless prompt whose picture will not open takes no key`() {
        let pressed = Pressed()
        let took = FeedRow(id: 0, content: .prompt(
            text: "",
            shots: [FeedShot.pasted(Self.media(nil))],
        )).activate(
            selection: Self.selection(writing: pressed),
            isExpanded: Binding(get: { pressed.isExpanded }, set: { pressed.isExpanded = $0 }),
        )

        #expect(!took)
        #expect(pressed.lit == nil)
        #expect(!pressed.isExpanded)
    }

    /// A prompt with words folds, pictures or not: the fold is what the row's control offers.
    @Test
    func `a prompt with words works its fold on Return`() {
        let shot = FeedShot.pasted(Self.media())
        let pressed = Self.pressing(.prompt(text: "the header sits too low", shots: [shot]))

        #expect(pressed.lit == nil)
        #expect(pressed.isExpanded)
    }

    /// Closing the lightbox hands the keyboard back to the row the picture was in — which for a
    /// pasted one is a prompt, not a gallery.
    @Test
    func `a prompt is where its own picture came from`() {
        let shot = FeedShot.pasted(Self.media())
        let row = FeedRow(id: 0, content: .prompt(text: "look", shots: [shot]))

        #expect(row.shows(shot))
    }
}
