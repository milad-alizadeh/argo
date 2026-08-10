@testable import ArgoUI
import CoreGraphics
import Testing

/// What the deck's zone measures claim about each other.
///
/// They guard the tokens, not the pixels: whether the zones are drawn where these say is a
/// question only the `sessionsDeck` specimen render answers, which is why the ticket demands
/// one. What a token invariant does catch is the next surface ticket widening its own zone
/// until the feed is no longer the surface the deck exists for.
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

    /// The list is what is still UNBUILT, so a surface shipping means a case leaves it. Asserted
    /// rather than left to review: a placeholder standing behind a real view is a second reading
    /// of the same zone, and the one a screen reader would find first.
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

    /// The panel-open half of the same invariant, and the one a long feed actually meets: a reader
    /// at the narrowest window who opens a call's evidence is reading BOTH columns at once, and a
    /// panel dragged to its ceiling must still leave the feed a column rather than a gutter.
    @Test
    func `the feed keeps its floor at the narrowest deck with the panel at its widest`() {
        let limits = ArgoLayout.evidencePanelLimits(in: narrowestDeckWidth)

        #expect(narrowestDeckWidth - limits.upperBound >= ArgoLayout.feedMinimumWidth)
    }

    /// The panel opens at its share before anybody drags it, and that opening width is the one
    /// nobody chose — so it is the one that can quietly sit outside the limits the drag respects.
    @Test
    func `the panel opens inside its own limits at the narrowest deck`() {
        let limits = ArgoLayout.evidencePanelLimits(in: narrowestDeckWidth)
        let opening = narrowestDeckWidth * ArgoLayout.evidencePanelShare

        #expect(limits.contains(opening))
    }

    /// A seam is dragged by a pointer that answers in fractions of a point, and what it sizes is a
    /// column of prose: a width between two points re-typesets every line in it, which is the
    /// shimmer a reader sees for as long as the seam is held.
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

    /// A deck measured in fractions is the ordinary case, not the edge one — a window is resized to
    /// whatever a pointer leaves it, and the panel's ceiling is derived from that width. Seating
    /// the limits inward is what keeps a panel dragged to its ceiling on a whole point too.
    @Test
    func `a fractional deck cannot put the panel back on a fraction`() {
        let deck = narrowestDeckWidth + 0.5137
        let limits = ArgoLayout.evidencePanelLimits(in: deck)
        let widest = ArgoLayout.seated(deck, in: limits)

        #expect(widest == widest.rounded())
        #expect(widest <= limits.upperBound)
        #expect(deck - widest >= ArgoLayout.feedMinimumWidth)
    }

    /// The reading measure is a ceiling, never a floor. A column that insisted on its own width
    /// would overflow the feed zone at the narrowest deck instead of narrowing with it, and the
    /// panel this ticket puts beside it is what makes that reachable rather than theoretical.
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

    @Test
    func `the deck's chrome leaves the content row most of its height`() {
        #expect(contentRowHeight > ArgoLayout.windowMinimumHeight / 2)
    }

    /// The composer floats over the reading rather than taking a row from it, so what it may
    /// cost the feed is scroll room, and even that must leave the reading most of the column at
    /// the shortest window.
    @Test
    func `the composer's clearance leaves the feed most of its column`() {
        #expect(contentRowHeight - ArgoComposerVessel.feedClearance > contentRowHeight / 2)
    }
}
