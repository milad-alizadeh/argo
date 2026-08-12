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

    /// The content row at the shortest window. It is the WHOLE deck: the canopy floats over it
    /// rather than sitting above it, so what the canopy costs the row is scroll room, not height.
    private var contentRowHeight: CGFloat {
        ArgoLayout.windowMinimumHeight
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
    func `only a zone too narrow for its own name turns its mark`() {
        let turned = DeckZone.allCases.filter(\.marksVertically)
        #expect(turned == [.minimap])
    }

    @Test
    func `the feed keeps the widest share of the row at the narrowest deck`() {
        let feed = narrowestDeckWidth - ArgoLayout.agentsRailWidth - ArgoLayout.minimapLaneWidth
        #expect(feed > ArgoLayout.agentsRailWidth)
        #expect(feed > ArgoLayout.minimapLaneWidth)
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
        #expect(ArgoLayout.minimapLaneWidth < ArgoLayout.agentsRailWidth / 2)
    }

    /// The canopy IS the two zones it covers. A third number would let the glass and the inset
    /// beneath it drift, which shows as rows either clipped at the top or floating below it.
    @Test
    func `the canopy covers exactly the header and the tabs`() {
        #expect(
            ArgoLayout.deckCanopyHeight
                == ArgoLayout.deckHeaderHeight + ArgoLayout.deckTabSlotHeight,
        )
    }

    /// Both float over the reading, so what they cost the feed is scroll room at each end. The
    /// shortest window is where the two of them together could eat the column.
    @Test
    func `the canopy and the composer together leave the feed most of its column`() {
        let taken = ArgoLayout.deckCanopyHeight + ArgoComposerVessel.feedClearance

        #expect(contentRowHeight - taken > contentRowHeight / 2)
    }
}
