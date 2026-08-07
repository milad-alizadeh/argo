@testable import ArgoUI
import CoreGraphics
import Testing

/// What the deck container claims about its own shape. None of it can be read off a screenshot
/// at every window size, and all of it is a rule a later surface ticket could quietly break
/// while its own render still looks right.
@Suite("Sessions deck container")
struct SessionsDeckTests {
    /// The narrowest deck the window can produce: the sidebar at its minimum still leaves this.
    private var narrowestDeckWidth: CGFloat {
        ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth
    }

    @Test
    func `the deck is flush to the window, not a floating card`() {
        #expect(ArgoRadius.deck == 0)
    }

    @Test
    func `every zone is marked, and no two slots read the same`() {
        let titles = DeckZone.allCases.map(\.title)
        #expect(titles.allSatisfy { !$0.isEmpty })
        #expect(Set(titles).count == titles.count)
    }

    @Test
    func `the feed keeps the widest share of the row, even at the narrowest deck`() {
        let feed = narrowestDeckWidth - ArgoLayout.agentsRailWidth - ArgoLayout.minimapLaneWidth
        #expect(feed > ArgoLayout.agentsRailWidth)
        #expect(feed > ArgoLayout.minimapLaneWidth)
    }

    @Test
    func `the lane is a lane, not a second rail`() {
        #expect(ArgoLayout.minimapLaneWidth < ArgoLayout.agentsRailWidth / 2)
    }

    @Test
    func `header, tabs and Dock leave the content row most of the deck's height`() {
        let chrome = ArgoLayout.deckHeaderHeight
            + ArgoLayout.deckTabSlotHeight
            + ArgoLayout.dockSeamHeight
        #expect(ArgoLayout.windowMinimumHeight - chrome > ArgoLayout.windowMinimumHeight / 2)
    }
}
