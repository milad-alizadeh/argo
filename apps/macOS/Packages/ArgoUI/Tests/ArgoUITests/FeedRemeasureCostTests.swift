import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a full re-measure COSTS when nothing has changed, and that it still costs what it must
/// when something has.
///
/// `.all` is not a rare pass. `FeedScrollPolicy` answers it for `resizeEnded` and for every
/// `settleElapsed` — 250 ms after any burst of width notices, and a panel revealing itself is a
/// burst. It used to surrender every measured height before re-measuring, so each of those
/// re-paid a full SwiftUI layout for every row in the reading whether or not one of them had
/// moved. The heights already answer for themselves: `FeedGeometry.Ground` names the whole of what
/// a height is a fact about, and the pass facts — the width and the ink — retire the store on
/// their own (`FeedGeometry.settle(at:in:)`). So the pass NOTES and drops nothing.
///
/// Counted in measurements, never in seconds: a measurement is one full SwiftUI layout pass, and
/// the count is what the pass cost rather than what the machine was doing (`CostMeasure`).
@Suite("Feed re-measure cost")
@MainActor
struct FeedRemeasureCostTests {
    /// The row a rewrite makes taller, far enough up the reading to be off screen at the end.
    private static let rewritten = 10

    /// The settle every width burst ends in, over a reading nothing has touched since it was
    /// measured. Zero, and it has to be zero at BOTH ends — the frame it lands in and the tail
    /// behind it — because the tail is the same work served in slices.
    @Test
    func `a full re-measure of an unchanged reading measures nothing`() async throws {
        let laid = FeedSwitchDeck()
        await laid.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let measured = laid.coordinator.measurements
        #expect(measured >= FeedSwitchFixture.alphaRows.count)

        laid.coordinator.settleAfterResize()
        let inTheFrame = laid.coordinator.measurements
        try await #require(laid.coordinator.tailing).value

        #expect(inTheFrame == measured)
        #expect(laid.coordinator.measurements == measured)
    }

    /// The other half of the claim, and the reason the drop is not needed: a row whose words
    /// changed answers `nil` to the height question by itself, so a reading that came back
    /// rewritten is re-measured where it moved and nowhere else.
    ///
    /// Two rows, exactly: the one that was rewritten, and the one BELOW it — `FeedGeometry.Ground`
    /// carries the row above, because the gap above a row is inside that row's height.
    @Test
    func `a row the reading rewrote is measured again and its neighbours are not`() async throws {
        let laid = FeedSwitchDeck()
        await laid.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let table = try #require(laid.coordinator.table)
        let was = laid.coordinator.measuredHeight(at: Self.rewritten, in: table)
        await laid.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let before = laid.coordinator.measurements

        var grown = FeedSwitchFixture.alphaRows
        grown[Self.rewritten] = FeedRow(
            id: Self.rewritten,
            content: .message(
                String(repeating: "The row grew, and by more than one line. ", count: 12),
            ),
        )
        await laid.show(grown, of: FeedSwitchFixture.alpha)

        #expect(laid.coordinator.measurements - before == 2)
        #expect(laid.coordinator.measuredHeight(at: Self.rewritten, in: table) > was)
    }

    /// The narrow scope, over a reading nothing has touched: zero, for the same reason `.all` is.
    /// It used to surrender the visible rows' heights before noting them, which re-paid a layout
    /// per row on screen every time a seam drag ended — and a height a drag did not move is still
    /// true of its row. A width that DID move retires the whole store on its own
    /// (`FeedGeometry.settle(at:in:)`), which is what leaves this pass nothing to drop.
    @Test
    func `a visible re-measure of an unchanged reading measures nothing`() async {
        let laid = FeedSwitchDeck()
        await laid.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        let measured = laid.coordinator.measurements
        #expect(measured >= FeedSwitchFixture.alphaRows.count)

        laid.coordinator.remeasure(.visible)

        #expect(laid.coordinator.measurements == measured)
    }

    /// The forced synchronous layout a re-measure does NOT pay for (#955, ADR-0028 Rule 2).
    ///
    /// `scroller.layoutSubtreeIfNeeded()` used to run on every scope, and a clip-view frame notice
    /// fires one per frame of a seam drag — the 1 530 ms half of #955, and the largest single
    /// figure in it. Counted in the table's own layout passes, which is what a forced layout IS:
    /// one pass realises and sizes every cell on screen (`FeedTableView.layouts`).
    ///
    /// `.visible` and `.rebuild` each leave a pass owing that the next layout pays for, so each of
    /// them reads one with the guard removed. `.none` reads zero either way — it is held by the
    /// early return rather than by the guard — and is here because removing that return is the same
    /// defect. The case below is what says the counter can see a forced layout at all.
    ///
    /// Mounted in a real window, because a windowless table lays nothing out for `.rebuild`: its
    /// `reloadData` marks and defers.
    @Test(arguments: [FeedRemeasure.none, .visible, .rebuild])
    func `a re-measure short of the settled pass forces no layout`(scope: FeedRemeasure) throws {
        let mounted = try Self.mounted()
        let before = try mounted.layouts

        mounted.coordinator.remeasure(scope)

        #expect(try mounted.layouts == before)
    }

    /// The one scope that does force a layout, and the control on the case above: `.all` is reached
    /// from a notification only through the 250 ms settle timer, and it is the pass that asks
    /// AppKit for its heights NOW rather than at the next layout. Exactly one, not merely more than
    /// none — the whole complaint was a pass per frame.
    @Test
    func `the settled re-measure forces one layout and no more`() throws {
        let mounted = try Self.mounted()
        let before = try mounted.layouts

        mounted.coordinator.remeasure(.all)
        // The tail is another suite's claim, and one left running measures rows under the next.
        mounted.coordinator.tailing?.cancel()

        #expect(try mounted.layouts == before + 1)
    }

    /// A reading long enough that most of it is off screen, every row wrapping the pane.
    private static let wrapping = (0 ..< 400).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    /// A reading laid out in a real window, which is where a forced layout can be seen at all. The
    /// window and the two values the shell keeps come back with the coordinator: the coordinator
    /// holds its scroll view weakly, and the window is what holds the table.
    private static func mounted() throws -> Mounted {
        let kept = FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: FeedGeometry())
        let coordinator = FeedTableFixture.laidOut(
            Self.wrapping, in: FeedSwitchDeck.pane, keeping: kept,
        )
        let scroller = try #require(coordinator.scroller)
        let window = NSWindow(
            contentRect: scroller.frame, styleMask: [.titled], backing: .buffered, defer: false,
        )
        window.contentView = scroller
        // Laid out until the COUNT stops moving, rather than until `needsLayout` clears: a mount
        // leaves passes owing below the table as well as on it, and a case that started there would
        // credit the scope under test with the mount's own.
        let table = try #require(coordinator.table)
        var settled = -1
        while settled != table.layouts {
            settled = table.layouts
            scroller.layoutSubtreeIfNeeded()
        }
        return Mounted(window: window, kept: kept, coordinator: coordinator)
    }

    @MainActor private struct Mounted {
        let window: NSWindow
        let kept: FeedTableFixture.Kept
        let coordinator: FeedTableCoordinator

        var layouts: Int {
            get throws { try #require(coordinator.table).layouts }
        }
    }
}
