import AppKit
@testable import ArgoUI
import Testing

/// What survives the reading being REPLACED rather than grown.
///
/// A rail chip scopes the feed onto a Subagent, which replaces every row under one handle. Two
/// shapes of that, and the lane is blind to both on its own. The table can be built again — the
/// lane's notifications are then registered on views the switch discarded, and the deck's own
/// update runs BEFORE the replacement exists (#1002). Or the table stands and only the reading is
/// replaced, which reaches the lane as a frame report it answers by its height (#1012).
@Suite("Minimap scope switch")
@MainActor
struct MinimapScopeSwitchTests {
    /// A Subagent's own reading. Shorter than the Session's by default, which is what makes a stale
    /// map visible at all.
    private static func delegated(_ count: Int = 8, saying: String = "own") -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message("The subagent's \(saying) line, number \($0)."))
        }
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

    /// Where the reading sits once the opening scroll it was owed has landed.
    ///
    /// Polled rather than slept on: the opening is claimed now and landed over a few runloop turns
    /// (`place()`), and there is no task to await — a fixed nap would be either a flake or a wait
    /// nobody needs.
    private static func settled(_ reading: NSScrollView) async throws -> CGFloat {
        for _ in 0 ..< 100 {
            let offset = reading.contentView.bounds.origin.y
            if offset > 0 {
                return offset
            }
            try await Task.sleep(for: .milliseconds(5))
        }
        return reading.contentView.bounds.origin.y
    }

    /// The scroll policy is a fact about the READING — where the reader left it, and how many rows
    /// have arrived since. A rail chip replaces every row under it.
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
            Self.delegated(60),
            in: MinimapLaneFixture.column,
            through: handle,
        )
        // Held for the length of the wait: the coordinator's references down to its views are weak,
        // as the deck's are, and SwiftUI is what keeps them alive in the app.
        let reading = try #require(scoped.scroller)

        #expect(handle.isFollowing)
        #expect(handle.leftAt == nil)
        let offset = try await Self.settled(reading)
        #expect(offset > MinimapLaneFixture.column.height / 2)
    }

    /// The same claim with the table it replaced already gone — a weak reference zeroed by a deinit
    /// runs no `didSet` at all. Nothing orders SwiftUI's teardown of the old representable against
    /// the new one's `makeNSView`, so whether a table stood cannot be read off `oldValue`.
    @Test
    func `a reading replaced after the last was let go opens at its own end`() {
        let handle = FeedTableHandle()
        autoreleasepool {
            let session = FeedTableFixture.laidOut(
                FeedProjection.longRows,
                in: MinimapLaneFixture.column,
                through: handle,
            )
            session.settle(at: 0, over: nil)
        }
        #expect(!handle.isFollowing)
        #expect(handle.coordinator == nil)

        _ = FeedTableFixture.laidOut(
            Self.delegated(60),
            in: MinimapLaneFixture.column,
            through: handle,
        )

        #expect(handle.isFollowing)
        #expect(handle.leftAt == nil)
    }

    /// A deck that opens its reading HELD at a row — a still, or a specimen. The row is a dense
    /// position, so the fresh policy has to be seeded with the row THIS reading is held at rather
    /// than the one the last was.
    @Test
    func `a replaced reading is held at its own row`() {
        let handle = FeedTableHandle(held: 250)
        _ = FeedTableFixture.laidOut(
            FeedProjection.longRows,
            in: MinimapLaneFixture.column,
            through: handle,
            held: 250,
        )

        _ = FeedTableFixture.laidOut(
            Self.delegated(60),
            in: MinimapLaneFixture.column,
            through: handle,
            held: 12,
        )

        #expect(!handle.isFollowing)
        #expect(handle.leftAt == 12)
    }

    /// The document REPLACED under a table whose frame never moved (#1012).
    ///
    /// Two readings shorter than the pane stand at the same document height — the table is at least
    /// as tall as its clip view — so the frame report the lane answers a reshape by carries
    /// nothing, and the map of the reading that left stayed up. `MinimapReadingStamp` says why a
    /// height cannot stand for a document; this is where not saying it costs the reader the map.
    @Test
    func `a reading replaced at the same document height is mapped afresh`() throws {
        let deck = MinimapLaneFixture.mounted(over: Self.delegated(3))
        deck.lane.layoutSubtreeIfNeeded()
        let height = deck.table.scroller?.documentView?.frame.height

        deck.table.keep(FeedGeometry())
        deck.table.apply(FeedTableFixture.model(
            showing: Self.delegated(2, saying: "other"),
            of: FeedReading(session: "one", scope: .subagent(1)),
        ))
        deck.lane.layoutSubtreeIfNeeded()

        // The precondition, stated: without it this suite would be asserting the reshape path.
        #expect(deck.table.scroller?.documentView?.frame.height == height)
        let reading = try #require(deck.feed.reading())
        #expect(deck.lane.geometry.documentHeight == MinimapGeometry(
            reading,
            lane: deck.lane.bounds.size,
        ).documentHeight)
    }

    @Test
    func `a feed scoped onto a subagent is the reading the lane maps`() throws {
        let deck = MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        deck.lane.layoutSubtreeIfNeeded()

        let scoped = Self.rescope(deck, onto: Self.delegated())

        let reading = try #require(deck.feed.reading())
        #expect(scoped.scroller === deck.feed.scroller)
        #expect(deck.lane.geometry.documentHeight == MinimapGeometry(
            reading,
            lane: deck.lane.bounds.size,
        ).documentHeight)
    }
}

/// The same claim through the REAL view tree, driven by the click that makes it: a rail chip, the
/// deck's own lane, and the map read off the lane the deck built beside the feed it re-scoped.
///
/// The suite above holds the lane to its claim one applied model at a time, and every case in it
/// could pass while the deck on screen went on drawing the map it had — #1003's own "Not covered"
/// section says as much, and #1012 is the gap it named.
@Suite("Minimap scope switch, hosted", .serialized)
@MainActor
struct HostedMinimapScopeSwitchTests {
    /// A → B → A, which is the case a height cannot see: two Subagents' readings are both shorter
    /// than the pane, so the document stands at exactly the same height for each of them.
    @Test(.enabled(if: WindowedTests.areAvailable))
    func `the lane beside a scoped feed maps that subagent's reading`() throws {
        let deck = HostedDeck()
        for _ in 0 ..< 12 {
            deck.grow()
        }

        for subagent in ["a-one", "a-two", "a-one"] {
            try deck.scope(onto: subagent)
            let reading = try #require(deck.coordinator.reading())
            let lane = try deck.lane
            #expect(lane.geometry.documentHeight == MinimapGeometry(
                reading,
                lane: lane.bounds.size,
            ).documentHeight, "The lane is not mapping \(subagent).")
        }
    }
}
