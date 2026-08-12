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
    private static let column = CGSize(width: 620, height: 480)

    /// A lane over a laid-out feed, with everything the deck holds for it held here.
    ///
    /// Both references down to the table are weak in the running app — the deck owns the handle
    /// and SwiftUI owns the coordinator — so a fixture that let either go would leave a lane
    /// attached to nothing, and every assertion below would pass against it.
    private struct Mounted {
        let lane: MinimapLaneView
        let feed: FeedTableHandle
        let table: FeedTableCoordinator
    }

    private static func mounted(over rows: [FeedRow]) -> Mounted {
        let feed = FeedTableHandle()
        let table = FeedTableFixture.laidOut(rows, in: column, through: feed)
        let lane = MinimapLaneView(
            frame: NSRect(x: 0, y: 0, width: ArgoLayout.minimapLaneWidth, height: column.height),
        )
        lane.palette = .graphite
        // Attached, not just pointed at the feed: what the lane does when the reading moves is the
        // notification it registered here, and a fixture that skipped it would leave every claim
        // below asserting a method this suite called itself.
        lane.attach(to: feed)
        return Mounted(lane: lane, feed: feed, table: table)
    }

    /// A press or a drag at a place in the lane, as the pointer would deliver it. The lane is in no
    /// window, so window space and its own are one space.
    private static func pointer(_ kind: NSEvent.EventType, at laneY: CGFloat) -> NSEvent? {
        NSEvent.mouseEvent(
            with: kind,
            location: NSPoint(x: ArgoLayout.minimapLaneWidth / 2, y: column.height - laneY),
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1,
        )
    }

    @Test
    func `scrolling the reading moves the viewport rectangle`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let atRest = deck.lane.viewportFrame

        deck.feed.settle(at: 900, over: nil)

        #expect(deck.lane.viewportFrame != atRest)
    }

    @Test
    func `scrolling the reading repaints nothing in the lane`() {
        let deck = Self.mounted(over: FeedProjection.longRows)
        let drawn = deck.lane.markRedraws

        deck.feed.settle(at: 900, over: nil)

        #expect(deck.lane.viewportFrame.minY > 0)
        #expect(deck.lane.markRedraws == drawn)
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

    @Test
    func `a scrub down the lane carries the reading with it`() throws {
        let deck = Self.mounted(over: FeedProjection.longRows)
        deck.feed.settle(at: 0, over: nil)
        try deck.lane.mouseDown(with: #require(Self.pointer(.leftMouseDown, at: 40)))
        let clicked = try #require(deck.feed.offset())

        try deck.lane.mouseDragged(with: #require(Self.pointer(.leftMouseDragged, at: 300)))

        #expect(try #require(deck.feed.offset()) > clicked)
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
        let frozen = deck.lane.markRedraws

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))

        #expect(deck.lane.markRedraws == frozen)
        try deck.lane.mouseUp(with: #require(Self.pointer(.leftMouseUp, at: 200)))
        #expect(deck.lane.markRedraws > frozen)
    }
}
