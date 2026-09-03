import AppKit
@testable import ArgoUI
import Testing

/// A real table with a real edge in a hand — the two reports a window drag is, driven at the seam
/// the table hears them at (`FeedTableView.liveResizeBegan`).
///
/// Nothing here stands in for anything: the coordinator, its scroll view and its `NSTableView` are
/// the ones the deck builds, because a table that only pretended to be resized would agree with
/// whatever the suite expected of a freeze.
@MainActor struct FeedDraggedDeck {
    let coordinator: FeedTableCoordinator
    let scroller: NSScrollView
    let table: FeedTableView

    init(_ coordinator: FeedTableCoordinator) throws {
        self.coordinator = coordinator
        self.scroller = try #require(coordinator.scroller)
        self.table = try #require(coordinator.table)
    }

    /// The pane a deck column is about this wide, and short enough that most of a reading is off
    /// screen — which is where the heights a re-wrap moves actually live.
    static let opening = CGSize(width: 460, height: 300)

    static func opened(over rows: [FeedRow]) async throws -> FeedDraggedDeck {
        let coordinator = await FeedTableFixture.laidOut(
            rows, in: Self.opening, through: FeedTableHandle(),
        )
        return try FeedDraggedDeck(coordinator)
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
