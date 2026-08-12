@testable import ArgoUI
import CoreGraphics
import Testing

/// What the deck's zone measures claim about each other. They guard the tokens, not the pixels —
/// where the zones actually land is the `sessionsDeck` specimen render's question.
@Suite("Sessions deck measures")
struct SessionsDeckTests {
    /// The narrowest deck the window can produce: the sidebar at its minimum still leaves this.
    private var narrowestDeckWidth: CGFloat {
        ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth
    }

    /// What the header and the tabs leave the row below them, at the shortest window.
    private var contentRowHeight: CGFloat {
        ArgoLayout.windowMinimumHeight - ArgoLayout.deckHeaderHeight - ArgoLayout.deckTabSlotHeight
    }

    @Test
    func `no two zones read the same on the deck`() {
        let titles = DeckZone.allCases.map(\.title)
        #expect(Set(titles).count == titles.count)
    }

    @Test
    func `every zone says what it is`() {
        #expect(DeckZone.allCases.allSatisfy { !$0.title.isEmpty })
    }

    /// The list is what is still UNBUILT, so a surface shipping means a case leaves it.
    @Test
    func `the feed is no longer a placeholder`() {
        #expect(!DeckZone.allCases.map(\.title).contains("Feed"))
    }

    @Test
    func `the minimap is no longer a placeholder`() {
        #expect(!DeckZone.allCases.map(\.title).contains("Minimap lane"))
    }

    @Test
    func `the feed keeps the widest share of the row at the narrowest deck`() {
        let beside = narrowestDeckWidth - ArgoLayout.agentsRailWidth
        let lane = ArgoLayout.minimapLaneWidth(sharing: beside)
        #expect(beside - lane > ArgoLayout.agentsRailWidth)
        #expect(beside - lane > lane)
    }

    /// The panel-open half of the same invariant.
    @Test
    func `the feed keeps its floor at the narrowest deck with the panel at its widest`() {
        let limits = ArgoLayout.evidencePanelLimits(in: narrowestDeckWidth)

        #expect(narrowestDeckWidth - limits.upperBound >= ArgoLayout.feedMinimumWidth)
    }

    /// The opening width is the one nobody chose, so it can sit outside the drag's limits.
    @Test
    func `the panel opens inside its own limits at the narrowest deck`() {
        let limits = ArgoLayout.evidencePanelLimits(in: narrowestDeckWidth)
        let opening = narrowestDeckWidth * ArgoLayout.evidencePanelShare

        #expect(limits.contains(opening))
    }

    /// A pointer answers in fractions of a point, and a column of prose at a width between two
    /// points re-typesets every line in it — the shimmer a reader sees while the seam is held.
    @Test
    func `a width dragged to a fraction is seated on a whole point`() {
        let seated = ArgoLayout.seated(263.4177, in: ArgoLayout.railWidths)

        #expect(seated == seated.rounded())
    }

    /// The rounding must not become a way out of the limits. Both directions, because a floor
    /// rounded down and a ceiling rounded up are each a zone drawn a point outside what it may be.
    @Test
    func `seating never lands a width outside its limits`() {
        let limits = ArgoLayout.railWidths

        #expect(ArgoLayout.seated(limits.lowerBound - 40, in: limits) == limits.lowerBound)
        #expect(ArgoLayout.seated(limits.upperBound + 40, in: limits) == limits.upperBound)
    }

    /// A fractional deck is the ordinary case, and the panel's ceiling is derived from that width —
    /// seating the limits inward is what keeps a panel at its ceiling on a whole point too.
    @Test
    func `a fractional deck cannot put the panel back on a fraction`() {
        let deck = narrowestDeckWidth + 0.5137
        let limits = ArgoLayout.evidencePanelLimits(in: deck)
        let widest = ArgoLayout.seated(deck, in: limits)

        #expect(widest == widest.rounded())
        #expect(widest <= limits.upperBound)
        #expect(deck - widest >= ArgoLayout.feedMinimumWidth)
    }

    /// The reading measure is a ceiling, never a floor.
    @Test
    func `the reading measure is wider than any deck can force the column to be`() {
        let openPanelFeed = narrowestDeckWidth - ArgoLayout.evidencePanelMinimumWidth

        #expect(ArgoFeedRow.column > openPanelFeed)
        #expect(ArgoLayout.feedMinimumWidth < ArgoFeedRow.column)
    }

    @Test
    func `the lane stays a lane rather than becoming a second rail`() {
        #expect(ArgoLayout.minimapLaneWidths.upperBound < ArgoLayout.agentsRailWidth / 2)
    }

    /// The lane is a share of the reading it maps, so its compression holds steady across the whole
    /// range of deck widths — which is what keeps the miniature looking the same at any of them.
    @Test
    func `the lane grows and shrinks with the reading beside it`() {
        let narrow = ArgoLayout.minimapLaneWidth(sharing: 620)
        let wide = ArgoLayout.minimapLaneWidth(sharing: 900)
        #expect(narrow < wide)
        #expect(ArgoLayout.minimapLaneWidths.contains(narrow))
    }

    /// The two ends of that share. Past either one the lane stops moving with the deck, exactly as
    /// Xcode's minimap does once the editor reaches its own widest.
    @Test
    func `the lane stops at its floor and its ceiling`() {
        let widths = ArgoLayout.minimapLaneWidths
        #expect(ArgoLayout.minimapLaneWidth(sharing: 200) == widths.lowerBound)
        #expect(ArgoLayout.minimapLaneWidth(sharing: 4000) == widths.upperBound)
    }

    @Test
    func `the deck's chrome leaves the content row most of its height`() {
        #expect(contentRowHeight > ArgoLayout.windowMinimumHeight / 2)
    }

    /// The composer floats over the reading, so what it costs the feed is scroll room.
    @Test
    func `the composer's clearance leaves the feed most of its column`() {
        #expect(contentRowHeight - ArgoComposerVessel.feedClearance > contentRowHeight / 2)
    }
}
