import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// How tall a feed row is allowed to come out.
///
/// A pipe table used to measure at ~1.2e308 points: its rules are flexible grid cells, and the
/// unbounded proposal the ruler asks with went straight into them. The table's row was fine; the
/// row AFTER it died, because `NSTableView` had summed origins past AppKit's ±2^45 window and the
/// arithmetic came out NaN.
@Suite("Feed row height")
@MainActor
struct FeedRowHeightTests {
    private static let width: CGFloat = 460

    private static let table = """
    | Ticket | Label |
    |---|---|
    | #474 | `ready-for-agent` |
    | #623 | `bug` |
    """

    /// The height the table itself would ask the delegate for, at a width a cell wraps at.
    private static func height(of content: FeedRow.Content) -> CGFloat {
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(
            [FeedRow(id: 0, content: content)],
            in: CGSize(width: width, height: 800),
            through: handle,
        )
        guard let table = coordinator.table else { return 0 }
        return coordinator.tableView(table, heightOfRow: 0)
    }

    @Test
    func `a row holding a pipe table is measured at the table's own height`() {
        let height = Self.height(of: .message(Self.table))

        #expect(height.isFinite)
        // Above the estimate, because a fallback would also be finite: the row has to have been
        // MEASURED, at the four-line table's real height rather than refused for a guess.
        #expect(height > FeedTableCoordinator.estimatedRowHeight)
        #expect(height < FeedTableCoordinator.maxRowHeight)
    }

    @Test
    func `a table is no taller than the prose of the same words`() {
        let prose = Self.height(of: .message("Ticket #474 is ready-for-agent, and #623 is a bug."))

        // The rules used to take the whole proposal, so the table stood at 1.2e308 against a
        // sentence's two lines. Generous, but any factor is a fixed ceiling the old bug clears.
        #expect(Self.height(of: .message(Self.table)) < prose * 10)
    }

    /// The guard behind the measurement, asked directly: no row content can reach it any more —
    /// the table was the only kind that flexed vertically — and its whole job is the kind of
    /// content that does not exist yet.
    @Test(arguments: [CGFloat.infinity, .nan, -1, FeedTableCoordinator.maxRowHeight + 1])
    func `a height no row could stand at gives way to the estimate`(_ measured: CGFloat) {
        #expect(FeedTableCoordinator.usableHeight(measured)
            == FeedTableCoordinator.estimatedRowHeight)
    }

    @Test(arguments: [CGFloat.zero, 240, FeedTableCoordinator.maxRowHeight])
    func `a height a row could stand at passes through untouched`(_ measured: CGFloat) {
        #expect(FeedTableCoordinator.usableHeight(measured) == measured)
    }
}
