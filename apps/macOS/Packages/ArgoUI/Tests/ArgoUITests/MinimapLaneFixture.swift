import AppKit
@testable import ArgoUI

/// A lane over a laid-out feed, for the suites that need a real one: `MinimapLaneTests` for what a
/// hand on it does to the reading, `MinimapAnnotationTests` for what the pointer names.
@MainActor
enum MinimapLaneFixture {
    static let column = CGSize(width: 620, height: 480)
    /// The lane's own width, taken the way the deck takes it — so the compression under every claim
    /// is the shipped one.
    static let width = ArgoLayout.minimapLaneWidth(sharing: column.width)

    /// Both references down to the table are weak in the running app — the deck owns the handle and
    /// SwiftUI owns the coordinator. A fixture that let either go would leave a lane attached to
    /// nothing, and every assertion against it would pass.
    struct Mounted {
        let lane: MinimapLaneView
        let feed: FeedTableHandle
        let table: FeedTableCoordinator
    }

    static func mounted(over rows: [FeedRow]) -> Mounted {
        let feed = FeedTableHandle()
        let table = FeedTableFixture.laidOut(rows, in: column, through: feed)
        let lane = MinimapLaneView(
            frame: NSRect(x: 0, y: 0, width: width, height: column.height),
        )
        lane.palette = .graphite
        // Attached, not just pointed at the feed: what the lane does when the reading moves is the
        // notification it registered here, and a fixture that skipped it would leave every claim
        // asserting a method the suite called itself.
        lane.attach(to: feed)
        // At the head of the reading, because a fresh one opens at its END and the claims are about
        // where the lane goes as the reading travels.
        feed.settle(at: 0, over: nil)
        return Mounted(lane: lane, feed: feed, table: table)
    }

    /// A press, a drag or a move at a place in the lane, as the pointer would deliver it. The lane
    /// is in no window, so window space and its own are one space.
    static func pointer(_ kind: NSEvent.EventType, at laneY: CGFloat) -> NSEvent? {
        NSEvent.mouseEvent(
            with: kind,
            location: NSPoint(x: width / 2, y: column.height - laneY),
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1,
        )
    }
}
