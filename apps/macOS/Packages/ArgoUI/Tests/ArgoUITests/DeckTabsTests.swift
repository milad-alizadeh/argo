@testable import ArgoUI
import Testing

/// What the deck's tabs claim. The model is the whole of the design's tab set; what is DRAWN is
/// the part of it with a surface behind it, and the gap between the two is the assertion worth
/// keeping — a tab that led nowhere would be a promise the deck cannot honour.
@Suite("Deck tabs")
struct DeckTabsTests {
    @Test
    func `the model carries the design's two tabs`() {
        #expect(DeckTab.allCases == [.activity, .delivery])
    }

    @Test
    func `every tab says what it is`() {
        #expect(DeckTab.allCases.allSatisfy { !$0.title.isEmpty })
    }

    @Test
    func `no two tabs read the same on the line`() {
        let titles = DeckTab.allCases.map(\.title)

        #expect(Set(titles).count == titles.count)
    }

    /// A tab is drawn once its pane exists and not before. Delivery's is #269, so this flips when
    /// that lands — the same rule the deck's placeholder zones followed.
    @Test
    func `only a tab with a surface behind it is drawn`() {
        #expect(DeckTab.shown == [.activity])
    }

    /// The zone is a control now, so the keyboard has somewhere to land in it — which is only
    /// true while the reading opens on a tab that is actually drawn.
    @Test
    func `the tab the reading opens on is one of the drawn ones`() {
        #expect(DeckTab.shown.contains(DeckTab.opening))
    }
}
