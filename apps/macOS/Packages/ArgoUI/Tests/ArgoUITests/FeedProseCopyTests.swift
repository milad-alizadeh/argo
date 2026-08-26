@testable import ArgoUI
import Testing

/// The offer drawn ON a prose row (#767).
///
/// A drag cannot leave the paragraph it started in — the feed draws every markdown block as its own
/// `Text` — so the chip is what a reader takes a whole answer with. It stands only where a drag is
/// defeated, which is what separates it from the menu's wider set.
@Suite("Feed prose copy")
struct FeedProseCopyTests {
    private static let fence = "Here it is:\n\n```swift\nlet x = 1\n```"

    @Test(arguments: [
        (FeedRow.Content.message(fence), fence, "Copy Message"),
        (.thought("Weighing it."), "Weighing it.", "Copy Thought"),
    ])
    func `prose the feed draws in blocks offers its source in place`(
        content: FeedRow.Content,
        words: String,
        label: String,
    ) {
        #expect(FeedRow(id: 0, content: content).inPlaceOffer
            == FeedRow.CopyOffer(words: words, label: label))
    }

    /// A prompt is one `Text` in a bubble and already drags end to end.
    @Test
    func `a prompt draws no chip`() {
        #expect(Self.asked.inPlaceOffer == nil)
    }

    /// It keeps the menu, though: the two offers are deliberately different sets.
    @Test
    func `a prompt keeps its menu`() {
        #expect(Self.asked.kind.words == "Fix the seam")
    }

    @Test(arguments: [
        FeedRow.Content.mark(.turnEnded(.endTurn)),
        .call(RowKindFixture.answeredCall),
    ])
    func `a row that is not prose offers nothing in place`(content: FeedRow.Content) {
        #expect(FeedRow(id: 0, content: content).inPlaceOffer == nil)
    }

    private static let asked = FeedRow(id: 0, content: .prompt(text: "Fix the seam", shots: []))
}
