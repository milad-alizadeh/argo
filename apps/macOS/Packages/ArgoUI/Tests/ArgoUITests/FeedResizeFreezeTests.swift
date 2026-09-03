import AppKit
@testable import ArgoUI
import Testing

/// What a drag on an edge costs the geometry: nothing at all while it runs, and one pass when it
/// ends (ADR-0030, Rule 6).
///
/// The claim is not about how a pass is scheduled. It is what a reader sees — rows that do not move
/// under the hand, and a document at the width they let go on that is the document a fresh measure
/// at that width would have produced. Counted in measurements, never in seconds: a measurement is
/// one row typeset, and the count is what the drag cost rather than what the machine was doing.
@Suite("Feed resize freeze")
@MainActor
struct FeedResizeFreezeTests {
    /// The pane a deck column is about this wide, and short enough that most of a reading is off
    /// screen — which is where the heights a re-wrap moves actually live.
    private static let opening = CGSize(width: 460, height: 300)
    /// The widths one drag crosses, and the one it ends on. Far enough apart that every row of the
    /// fixture re-wraps at each of them.
    private static let widths: [CGFloat] = [400, 340, 300]
    private static let landed: CGFloat = 300

    private static let rows = (0 ..< 120).map {
        FeedRow(
            id: $0,
            content: .message("A line of prose long enough to wrap the pane, number \($0)."),
        )
    }

    @Test
    func `a drag through three widths measures nothing and moves no row`() async throws {
        let deck = try await Dragged.opened(over: Self.rows)
        let measured = deck.coordinator.measurements
        let stood = try deck.heights()

        deck.began()
        for width in Self.widths {
            deck.widen(to: width)
        }
        try await Self.quietElapsed()

        #expect(deck.coordinator.measurements == measured)
        #expect(try deck.heights() == stood)
        #expect(deck.coordinator.geometry.settled?.stamp.width == Self.opening.width)
        // Clipped and unreflowed: the rows are still DRAWN across the width they were measured at,
        // so no visible cell re-wraps at drag rate under heights that are not allowed to follow.
        #expect(deck.table.frame.width == Self.opening.width)
    }

    @Test
    func `the drag ending measures the reading once, at the width it ended on`() async throws {
        let deck = try await Dragged.opened(over: Self.rows)
        let measured = deck.coordinator.measurements

        deck.began()
        for width in Self.widths {
            deck.widen(to: width)
        }
        try await Self.quietElapsed()
        await deck.ended()

        #expect(deck.coordinator.measurements - measured == Self.rows.count)
        #expect(deck.coordinator.geometry.settled?.stamp.width == Self.landed)
        #expect(deck.table.frame.width == Self.landed)
    }

    /// The half a count cannot say: one pass is worth nothing if the document it leaves is not the
    /// document the reader would have had by opening the reading at that width to begin with.
    @Test
    func `the heights a drag ends on are the heights a fresh measure gives`() async throws {
        let deck = try await Dragged.opened(over: Self.rows)

        deck.began()
        for width in Self.widths {
            deck.widen(to: width)
        }
        await deck.ended()

        let afresh = await FeedTableFixture.laidOut(
            Self.rows,
            in: CGSize(width: Self.landed, height: Self.opening.height),
            through: FeedTableHandle(),
        )
        #expect(try deck.heights() == afresh.geometry.settled?.everyHeight)
    }

    /// A reading the reader has left is not re-wrapped by a drag on the one they are looking at:
    /// heights are held per reading (`FeedGeometries`), and only the reading on screen has a table
    /// whose width moved.
    @Test
    func `a reading that is not on screen is not measured by the drag`() async throws {
        let deck = await FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let alpha = deck.geometries.geometry(for: FeedSwitchFixture.alpha)
        let stood = try #require(alpha.settled)
        let dragged = try Dragged(deck.coordinator)

        dragged.began()
        dragged.widen(to: Self.widths[0])
        await dragged.ended()

        #expect(alpha.settled?.everyHeight == stood.everyHeight)
        #expect(alpha.settled?.stamp.width == stood.stamp.width)
    }

    /// The other half of the same claim: the pass the hidden reading was spared is the pass its
    /// next SHOW runs.
    @Test
    func `the reading measures at the fresh width on its next show`() async throws {
        let deck = await FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let alpha = deck.geometries.geometry(for: FeedSwitchFixture.alpha)
        let dragged = try Dragged(deck.coordinator)

        dragged.began()
        dragged.widen(to: Self.widths[0])
        await dragged.ended()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        #expect(alpha.settled?.stamp.width == Self.widths[0])
    }

    /// Longer than the quiet a width burst is normally answered after, so a case that measured
    /// nothing measured nothing because the table was frozen rather than because it did not wait.
    private static func quietElapsed() async throws {
        try await Task.sleep(for: .milliseconds(FeedTableCoordinator.quietMilliseconds + 150))
    }

    /// A real table with a real edge in a hand — the two reports a window drag is, driven at the
    /// seam the table hears them at (`FeedTableView.liveResizeBegan`).
    @MainActor private struct Dragged {
        let coordinator: FeedTableCoordinator
        let scroller: NSScrollView
        let table: FeedTableView

        init(_ coordinator: FeedTableCoordinator) throws {
            self.coordinator = coordinator
            self.scroller = try #require(coordinator.scroller)
            self.table = try #require(coordinator.table)
        }

        static func opened(over rows: [FeedRow]) async throws -> Dragged {
            let coordinator = await FeedTableFixture.laidOut(
                rows, in: FeedResizeFreezeTests.opening, through: FeedTableHandle(),
            )
            return try Dragged(coordinator)
        }

        func began() {
            table.liveResizeBegan?()
        }

        /// The edge let go of, and the one pass it owes run to completion.
        func ended() async {
            table.liveResizeEnded?()
            await FeedTableFixture.settled(coordinator)
        }

        /// One frame of the drag: the pane at a fresh width, reported the way AppKit reports it.
        func widen(to width: CGFloat) {
            scroller.frame = NSRect(x: 0, y: 0, width: width, height: scroller.frame.height)
            scroller.layoutSubtreeIfNeeded()
            FeedTableFixture.postFrameChange(on: scroller.contentView)
        }

        func heights() throws -> [CGFloat] {
            try #require(coordinator.geometry.settled).everyHeight
        }
    }
}
