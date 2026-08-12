import AppKit
@testable import ArgoUI
import Testing

/// The lane over a real feed: what a hand on it does to the reading, what moves when the reading
/// moves, and what does not.
///
/// The last one is the point. A minimap that repaints its marks on every scroll frame is why this
/// surface is AppKit and not a `Canvas`, and nothing about that is visible — it reads as a feed
/// gone heavy, three surfaces from the cause.
@Suite("Minimap lane")
@MainActor
struct MinimapLaneTests {
    private static let column = MinimapLaneFixture.column
    private static let width = MinimapLaneFixture.width

    private static func mounted(over rows: [FeedRow]) -> MinimapLaneFixture.Mounted {
        MinimapLaneFixture.mounted(over: rows)
    }

    private static func pointer(_ kind: NSEvent.EventType, at laneY: CGFloat) -> NSEvent? {
        MinimapLaneFixture.pointer(kind, at: laneY)
    }

    @Test
    func `scrolling the reading moves the viewport rectangle`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let atRest = deck.lane.viewportFrame

        deck.feed.settle(at: 900, over: nil)

        #expect(deck.lane.viewportFrame != atRest)
    }

    @Test
    func `scrolling inside the rasterised band repaints nothing in the lane`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let drawn = deck.lane.markRedraws
        let marks = deck.lane.marksFrame

        deck.feed.settle(at: 900, over: nil)

        #expect(deck.lane.viewportFrame.minY > 0)
        #expect(deck.lane.markRedraws == drawn)
        // The miniature slid, and it slid by moving the layer rather than by drawing into it.
        #expect(deck.lane.marksFrame != marks)
    }

    @Test
    func `the miniature is taller than the lane and slides the head of it off the top`() throws {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let lane = deck.lane.geometry
        #expect(lane.miniatureHeight > Self.column.height)
        #expect(lane.laneOffset(at: lane.offsetRange.lowerBound) == 0)

        deck.feed.settle(at: .greatestFiniteMagnitude, over: nil)

        #expect(try lane.laneOffset(at: #require(deck.feed.offset())) > 0)
        // The band now hangs off the top of the lane, which is the head of the session below the
        // fold — the whole difference from #402's one lane-sized bitmap.
        #expect(deck.lane.marksFrame.maxY > Self.column.height)
    }

    /// The band is taller than the lane, so something has to clip it — but not the lane itself,
    /// which lets a Turn's label out to the reading beside it.
    @Test
    func `the band is clipped to the lane it hangs out of`() {
        let deck = Self.mounted(over: FeedProjection.longRows)

        #expect(deck.lane.marksFrame.height > Self.column.height)
        #expect(deck.lane.clipsMarksOnly)
    }

    /// Once, for the whole travel from one end of the session to the other. How big the band that
    /// gets drawn is belongs to `MinimapBandTests`.
    @Test
    func `leaving the band draws the new one, and only the new one`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let drawn = deck.lane.markRedraws

        deck.feed.settle(at: .greatestFiniteMagnitude, over: nil)

        #expect(deck.lane.markRedraws == drawn + 1)
    }

    @Test
    func `a reading that has not changed shape is not re-rasterised`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let drawn = deck.lane.markRedraws

        deck.lane.refresh()

        #expect(deck.lane.markRedraws == drawn)
    }

    @Test
    func `a click on the lane takes the reading to what was clicked`() throws {
        let deck = Self.mounted(over: FeedProjection.longRows)
        deck.feed.settle(at: 4000, over: nil)

        try deck.lane.mouseDown(with: #require(Self.pointer(.leftMouseDown, at: 40)))

        // Clicked near the head of the lane, so the reading went back towards its start.
        #expect(try #require(deck.feed.offset()) < 4000)
    }

    /// The ticket asks for a click on a Turn to scroll the feed TO it, so the reading opens at the
    /// Turn's head rather than centred on wherever inside it the hand happened to land.
    @Test
    func `a click on a Turn opens the reading at that Turn`() throws {
        let deck = Self.mounted(over: FeedProjection.longRows)
        deck.feed.settle(at: 0, over: nil)
        let laneY: CGFloat = 200
        let named = try #require(deck.lane.geometry.block(atMiniatureY: laneY))

        try deck.lane.mouseDown(with: #require(Self.pointer(.leftMouseDown, at: laneY)))

        // The Turn's head is now at the top of what is on screen, within one drawn line of it.
        let opened = try deck.lane.geometry.viewportY(at: #require(deck.feed.offset()))
        #expect(abs(opened - named.y) < deck.lane.geometry.lineSlot)
    }

    /// D25's map may not depend on colour, and under Increased Contrast a shape has to clear the
    /// surface it sits on before it has to sit under the words.
    @Test
    func `the runs are drawn louder under Increased Contrast`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let quiet = deck.lane.markRedraws

        deck.lane.raisesContrast = true

        #expect(deck.lane.markRedraws > quiet)
    }

    @Test
    func `a scrub down the lane carries the reading with it`() throws {
        let deck = Self.mounted(over: FeedProjection.longRows)
        deck.feed.settle(at: 0, over: nil)
        try deck.lane.mouseDown(with: #require(Self.pointer(.leftMouseDown, at: 40)))
        let clicked = try #require(deck.feed.offset())

        try deck.lane.mouseDragged(with: #require(Self.pointer(.leftMouseDragged, at: 300)))

        #expect(try #require(deck.feed.offset()) > clicked)
    }

    /// The reading stops widening at its measure, so past that the miniature stops compressing —
    /// a wider deck gets a wider lane rather than a denser one.
    @Test
    func `a zone wider than the reading measure does not compress the lane further`() throws {
        let wide = CGSize(width: 1200, height: Self.column.height)
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(FeedProjection.longRows, in: wide, through: handle)

        #expect(try #require(table.reading()).columnWidth == ArgoFeedRow.column)
    }

    /// The lit range is an area, not an outline — and a brighter area under the pointer. Both are a
    /// ground on one layer, so lighting it repaints no marks.
    @Test
    func `the lit range brightens under the pointer without repainting the marks`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let rest = deck.lane.viewportGround
        let drawn = deck.lane.markRedraws

        deck.lane.mouseEntered(with: NSEvent())

        #expect(deck.lane.viewportGround != rest)
        #expect(deck.lane.markRedraws == drawn)
    }

    /// One scrollbar, not two. The lit rectangle already stands for the visible range, and the
    /// platform's own knob would draw BETWEEN the reading and its map.
    @Test
    func `the reading never draws a scrollbar of its own`() throws {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(
            FeedProjection.longRows, in: Self.column, through: handle,
        )
        #expect(try !#require(table.scroller).hasVerticalScroller)

        table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))

        #expect(try !#require(table.scroller).hasVerticalScroller)
    }

    @Test
    func `the viewport rectangle stays inside the lane at either end of the reading`() {
        let deck = Self.mounted(over: FeedProjection.longRows)

        deck.feed.settle(at: -.greatestFiniteMagnitude, over: nil)
        #expect(deck.lane.viewportFrame.minY >= 0)
        #expect(deck.lane.viewportFrame.maxY <= Self.column.height)

        deck.feed.settle(at: .greatestFiniteMagnitude, over: nil)
        #expect(deck.lane.viewportFrame.minY >= 0)
        #expect(deck.lane.viewportFrame.maxY <= Self.column.height)
    }

    @Test
    func `a row arriving mid-scrub does not reflow the lane under the hand`() throws {
        let deck = Self.mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        try deck.lane.mouseDown(with: #require(Self.pointer(.leftMouseDown, at: 200)))
        let frozen = deck.lane.geometry

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))

        #expect(deck.lane.geometry == frozen)
        try deck.lane.mouseUp(with: #require(Self.pointer(.leftMouseUp, at: 200)))
        #expect(deck.lane.geometry.documentHeight > frozen.documentHeight)
    }

    /// A feed append lands below what the lane is showing, so it costs no pixels at all — the band
    /// is compared on its marks rather than on the reading, and those did not move.
    @Test
    func `a row arriving below the band draws nothing`() {
        let deck = Self.mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        deck.feed.settle(at: 0, over: nil)
        let drawn = deck.lane.markRedraws

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))
        deck.lane.refresh()

        #expect(deck.lane.markRedraws == drawn)
    }
}
