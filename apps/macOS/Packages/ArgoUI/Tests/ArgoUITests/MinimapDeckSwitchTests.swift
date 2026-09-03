import AppKit
@testable import ArgoUI
import Testing

/// One lane, two decks — what happens to the reading it was holding (#1132).
///
/// The lane view is REUSED across a Session switch. `DeckContentRow` places `MinimapLaneZone` at
/// one structural position with no `.id`, and `MinimapLaneZone` tears the lane down only when the
/// feed is unsettled — so on a deck the reader has opened before, which `KeptDecks` and
/// `FeedGeometries` hand back already settled, the branch never flips and the same view carries on
/// with the previous Session's `read`, `readAt` and `geometry`.
///
/// `attach(to:)` forgot the last document HEIGHT and nothing else. What that leaves is a lane
/// drawing one reading's miniature over another reading's feed, scrolling faithfully against an
/// offset that means nothing in the space it is painting — the miniature past the end of the feed,
/// and the lit rectangle at a position the reader cannot make sense of.
///
/// `MinimapReadingStamp` already promises this in writing: "where what it holds is another
/// reading's, it draws nothing at all". These are the cases that make that sentence true.
@Suite("Minimap across a deck switch", .serialized)
@MainActor
struct MinimapDeckSwitchTests {
    /// Two readings of plainly different lengths, so a lane still holding the first cannot
    /// accidentally agree with the second.
    private static let shortReading = (0 ..< 40).map {
        FeedRow(id: $0, content: .message("A short line, number \($0)."))
    }

    private static let longReading = (0 ..< 600).map {
        FeedRow(id: $0, content: .message(
            "A line of prose long enough to wrap the reading measure more than once, number \($0).",
        ))
    }

    /// The lane re-pointed at another deck maps THAT deck, not the one it came from.
    @Test
    func `a lane moved to another deck stops mapping the one it left`() async throws {
        let long = await MinimapLaneFixture.mounted(over: Self.longReading)
        long.lane.layoutSubtreeIfNeeded()
        let held = long.lane.geometry.documentHeight
        #expect(held > 0, "the lane must have mapped the first deck at all")

        let short = await MinimapLaneFixture.mounted(over: Self.shortReading)
        let fresh = try #require(short.table.geometry.settled)
        long.lane.attach(to: short.feed)
        long.lane.layoutSubtreeIfNeeded()

        #expect(long.lane.geometry.documentHeight != held)
        #expect(abs(long.lane.geometry.documentHeight - fresh.totalHeight) <= 1)
    }

    /// And the other order — a lane that mapped a SHORT reading must not keep drawing a miniature
    /// far shorter than the feed it is now beside.
    @Test
    func `a lane moved from a short deck maps the long one it arrived at`() async throws {
        let short = await MinimapLaneFixture.mounted(over: Self.shortReading)
        short.lane.layoutSubtreeIfNeeded()
        let held = short.lane.geometry.documentHeight

        let long = await MinimapLaneFixture.mounted(over: Self.longReading)
        let fresh = try #require(long.table.geometry.settled)
        short.lane.attach(to: long.feed)
        short.lane.layoutSubtreeIfNeeded()

        #expect(short.lane.geometry.documentHeight != held)
        #expect(abs(short.lane.geometry.documentHeight - fresh.totalHeight) <= 1)
    }

    /// The case the two above cannot reach, and the one the reader meets: the deck arrived at has
    /// no settled document YET.
    ///
    /// A deck surrenders its document whenever the reading it stands for changed while the reader
    /// was away — which for a live Session is every time. `refresh()` then has nothing to derive
    /// from, and its guard sits above the line that writes `geometry`, so it returns leaving the
    /// PREVIOUS deck's miniature painted. Nothing retires it: the reshape notice that would is
    /// dropped, because on a revisited deck the document lands during `apply()` while the lane's
    /// closure is still nil, and the scroll notice only re-places the layers against the geometry
    /// that is already there.
    @Test
    func `a lane moved to a deck with no document yet draws none of the old one`() async {
        let long = await MinimapLaneFixture.mounted(over: Self.longReading)
        long.lane.layoutSubtreeIfNeeded()
        let held = long.lane.geometry.documentHeight
        #expect(held > 0, "the lane must have mapped the first deck at all")

        let short = await MinimapLaneFixture.mounted(over: Self.shortReading)
        short.table.surrenderDocument()
        #expect(short.table.geometry.isSettled == false, "the arriving deck must be unsettled")

        long.lane.attach(to: short.feed)
        long.lane.layoutSubtreeIfNeeded()

        #expect(long.lane.geometry.documentHeight != held)
    }
}
