import AppKit
@testable import ArgoUI
import Testing

/// What the lane maps when the reading beside it is REPLACED rather than grown.
///
/// A rail chip scopes the feed onto a Subagent, and `FeedColumn` is keyed to that scope — so the
/// table, its scroll view and its coordinator are all torn down and built again under one handle.
/// Nothing about that arrives as a reshape: the lane's notifications are registered on views the
/// switch discarded, and the deck's own update runs BEFORE the replacement table exists.
@Suite("Minimap scope switch")
@MainActor
struct MinimapScopeSwitchTests {
    /// A Subagent's reading — shorter than the Session's, which is what makes a stale map visible.
    private static let scoped = (0 ..< 8).map {
        FeedRow(id: $0, content: .message("The subagent's own line, number \($0)."))
    }

    /// The deck re-scoping its one feed, in the order SwiftUI runs it: the lane is dressed with the
    /// handle it already holds, and the replacement table repoints that handle afterwards.
    private static func rescope(
        _ deck: MinimapLaneFixture.Mounted,
        onto rows: [FeedRow],
    )
        -> FeedTableCoordinator {
        deck.lane.attach(to: deck.feed)
        let scoped = FeedTableFixture.laidOut(
            rows,
            in: MinimapLaneFixture.column,
            through: deck.feed,
        )
        deck.lane.layoutSubtreeIfNeeded()
        return scoped
    }

    /// A Subagent's reading long enough to have an end to open at.
    private static let delegated = (0 ..< 60).map {
        FeedRow(id: $0, content: .message("The subagent's own line, number \($0)."))
    }

    /// The scroll policy is a fact about the READING — where the reader left it, and how many rows
    /// have arrived since. A rail chip replaces every row under it, so a latch carried across says
    /// the reader left an end they never reached, and parks the fresh reading wherever the last one
    /// was read.
    @Test
    func `a reading replaced under one handle opens at its own end`() async throws {
        let handle = FeedTableHandle()
        let session = FeedTableFixture.laidOut(
            FeedProjection.longRows,
            in: MinimapLaneFixture.column,
            through: handle,
        )
        // The state a chip is clicked in: the reader has scrolled back up through the Session.
        session.settle(at: 0, over: nil)
        #expect(!handle.isFollowing)

        let scoped = FeedTableFixture.laidOut(
            Self.delegated,
            in: MinimapLaneFixture.column,
            through: handle,
        )
        // Held for the length of the wait: the coordinator's own references down to the views are
        // weak, as the deck's are, and SwiftUI is what keeps them alive in the app.
        let reading = try #require(scoped.scroller)
        // The opening is claimed now and landed a runloop turn later — see `place()`.
        try await Task.sleep(for: .milliseconds(50))

        #expect(handle.isFollowing)
        #expect(handle.leftAt == nil)
        #expect(reading.contentView.bounds.origin.y > MinimapLaneFixture.column.height / 2)
    }

    /// The heights the shell keeps across the switch — one store for the whole Session, handed to
    /// whichever table is up (#858). A height in it is a fact about a ROW, so a reading that
    /// replaces every row must measure every row again.
    @Test
    func `a scoped reading is as tall as its own rows`() throws {
        let kept = FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: FeedGeometry())
        _ = FeedTableFixture.laidOut(
            FeedProjection.longRows,
            in: MinimapLaneFixture.column,
            keeping: kept,
        )
        let scoped = FeedTableFixture.laidOut(
            Self.scoped,
            in: MinimapLaneFixture.column,
            keeping: kept,
        )
        let alone = FeedTableFixture.laidOut(
            Self.scoped,
            in: MinimapLaneFixture.column,
            through: FeedTableHandle(),
        )

        let document = try #require(scoped.scroller?.documentView?.frame.height)
        #expect(document == alone.scroller?.documentView?.frame.height)
    }

    @Test
    func `a feed scoped onto a subagent is the reading the lane maps`() throws {
        let deck = MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        deck.lane.layoutSubtreeIfNeeded()

        let scoped = Self.rescope(deck, onto: Self.scoped)

        let reading = try #require(deck.feed.reading())
        #expect(scoped.scroller === deck.feed.scroller)
        #expect(deck.lane.geometry.documentHeight == MinimapGeometry(
            reading,
            lane: deck.lane.bounds.size,
        ).documentHeight)
    }
}
