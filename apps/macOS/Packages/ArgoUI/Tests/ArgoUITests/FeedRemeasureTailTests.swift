import AppKit
@testable import ArgoUI
import Foundation
import Testing

/// What a full re-measure costs in the frame it lands in, and what it leaves for later: the
/// viewport squared up now, everything else in bounded batches, none of it dropped (#856).
///
/// Counted in measurements rather than in seconds. A wall clock on a shared machine measures the
/// machine; the count of SwiftUI layout passes IS what a re-measure costs.
@Suite("Feed re-measure tail")
@MainActor
struct FeedRemeasureTailTests {
    /// Long enough that a pane this size cannot hold a tenth of it, so there is a real tail — and
    /// several batches long, so the tail takes more than one turn of the run loop.
    private static let rows = (0 ..< 200).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    private static let pane = CGSize(width: 460, height: 300)

    /// How many turns the tail is given to finish before the claim is that it stalled — far more
    /// than the batches it takes, and short enough that a stall is a failure rather than a hang.
    private static let turnsAllowed = 500

    /// The coordinator's own references down to the scroller are weak — SwiftUI owns the view in
    /// the running app. A suite that let the scroller go would suspend at its first `await` and
    /// wake up over nothing, with every claim passing.
    struct Dragged {
        let scroller: NSScrollView
        let table: FeedTableCoordinator
    }

    /// A laid-out reading mid seam-drag: every row measured against one width, and the pane now at
    /// another. Only the rows on screen have been squared up, which is what a live drag leaves —
    /// so every other row stands on a height from the width before.
    private static func midDrag(_ handle: FeedTableHandle) throws -> Dragged {
        let table = FeedTableFixture.laidOut(rows, in: pane, through: handle)
        let scroller = try #require(table.scroller)
        // The fixture attaches the handle only after the first layout, so the policy has yet to see
        // a width at all: this one is the first REAL width, which rebuilds against it. The one
        // after it is the drag.
        scroller.frame = NSRect(x: 0, y: 0, width: 500, height: pane.height)
        scroller.frame = NSRect(x: 0, y: 0, width: 560, height: pane.height)
        return Dragged(scroller: scroller, table: table)
    }

    /// The same, with the seam let go — where every claim about the tail starts.
    private static func letGo(_ handle: FeedTableHandle) throws -> Dragged {
        let dragged = try midDrag(handle)
        dragged.table.settleAfterResize()
        return dragged
    }

    @Test
    func `the frame the seam lets go in measures the rows on screen and no more`() throws {
        let handle = FeedTableHandle()
        let dragged = try Self.midDrag(handle)
        let before = dragged.table.measurements

        dragged.table.settleAfterResize()

        let visible = dragged.table.visibleRows().count
        #expect(visible > 0)
        #expect(dragged.table.measurements - before <= visible)
    }

    /// The tail runs to the end rather than leaving the rest to scroll-in measurement — see
    /// `FeedTableCoordinator.measureTail`.
    @Test
    func `the rows nobody can see are measured by the tail behind it`() async throws {
        let handle = FeedTableHandle()
        let dragged = try Self.letGo(handle)
        let tail = Self.rows.count - dragged.table.visibleRows().count
        let before = dragged.table.measurements

        try await #require(dragged.table.tailing).value

        #expect(tail > 0)
        #expect(dragged.table.measurements - before >= tail)
    }

    /// No batch may cost what the one block cost, or the tail is the same hang served in slices.
    @Test
    func `no one turn of the tail measures more than a batch`() async throws {
        let handle = FeedTableHandle()
        let dragged = try Self.letGo(handle)
        let wanted = dragged.table.measurements + Self.rows.count
            - dragged.table.visibleRows().count
        var most = 0
        var last = dragged.table.measurements
        // Bounded, so a tail that stalls fails the claim rather than hanging the suite.
        var turns = 0

        while last < wanted, turns < Self.turnsAllowed {
            try await Task.sleep(for: .milliseconds(1))
            most = max(most, dragged.table.measurements - last)
            last = dragged.table.measurements
            turns += 1
        }

        #expect(last == wanted)
        #expect(most > 0)
        #expect(most <= FeedTableCoordinator.remeasureBatch)
    }

    /// A seam drag fires many: a tail still running against a width the reader has already left is
    /// work thrown away, and it notes rows the fresher pass is about to note again. So two passes
    /// back to back cost ONE pass over the reading, not two.
    @Test
    func `a fresh full re-measure retires the tail already running`() async throws {
        let handle = FeedTableHandle()
        let dragged = try Self.letGo(handle)
        let stale = try #require(dragged.table.tailing)
        let before = dragged.table.measurements

        dragged.table.settleAfterResize()
        try await #require(dragged.table.tailing).value
        await stale.value

        let onePass = Self.rows.count + FeedTableCoordinator.remeasureBatch
        #expect(dragged.table.measurements - before <= onePass)
    }

    /// Nothing is left un-measured once the tail has run, so the document height the minimap is a
    /// miniature of settles on the value the one-block re-measure gave it in a single frame.
    @Test
    func `the reading stands at the sum of its measured rows once the tail has run`() async throws {
        let handle = FeedTableHandle()
        let dragged = try Self.letGo(handle)
        let table = try #require(dragged.table.table)

        try await #require(dragged.table.tailing).value
        let measured = dragged.table.measurements

        let summed = Self.rows.indices
            .reduce(0) { $0 + dragged.table.measuredHeight(at: $1, in: table) }
        // Nothing was left for the sum itself to measure: every height it added was already known.
        #expect(dragged.table.measurements == measured)
        #expect(table.frame.height == summed)
    }
}
