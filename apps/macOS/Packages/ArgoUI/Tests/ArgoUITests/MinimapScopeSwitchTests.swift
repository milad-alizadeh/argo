import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the lane does when ANOTHER DECK arrives under it.
///
/// A rail chip scopes the feed onto a Subagent, which is another reading and so another kept deck
/// (ADR-0030, Rule 4). The lane is blind to that on its own: its notifications are registered on
/// the views of the deck that left, and the deck's own update runs before the lane is re-dressed
/// (#1002). The sharper shape is #1012 — the fresh deck's document can stand at exactly the height
/// the lane already answered for, so the frame report carries nothing and the map of the reading
/// that left would stay up.
///
/// Where a reading LANDS on a switch is not here any more: a deck opens with a scroll policy of its
/// own and never inherits one, which `FeedReadingSwitchTests` asks over the real store.
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

    /// The deck re-scoping, in the order SwiftUI runs it: the scope's own deck is built and laid
    /// out, and the lane beside it is re-dressed with that deck's handle — which is what
    /// `MinimapLane.dress` does on every update of the deck.
    private static func rescope(
        _ deck: MinimapLaneFixture.Mounted,
        onto rows: [FeedRow],
    )
        async -> MinimapLaneFixture.Mounted {
        let feed = FeedTableHandle()
        let scoped = await FeedTableFixture.laidOut(
            rows,
            in: MinimapLaneFixture.column,
            through: feed,
        )
        deck.lane.attach(to: feed)
        deck.lane.layoutSubtreeIfNeeded()
        return MinimapLaneFixture.Mounted(lane: deck.lane, feed: feed, table: scoped)
    }

    /// The document of ANOTHER DECK, standing at exactly the height the lane already answered
    /// for (#1012).
    ///
    /// Two readings shorter than the pane stand at the same document height — a table is at least
    /// as tall as its clip view — so the frame report the lane answers a reshape by carries
    /// nothing, and the map of the reading that left stayed up. `MinimapReadingStamp` says why a
    /// height cannot stand for a document; this is where not saying it costs the reader the map.
    @Test
    func `another deck at the same document height is mapped afresh`() async throws {
        let deck = await MinimapLaneFixture.mounted(over: Self.delegated(3))
        deck.lane.layoutSubtreeIfNeeded()
        let height = deck.table.scroller?.documentView?.frame.height

        let scoped = await Self.rescope(deck, onto: Self.delegated(2, saying: "other"))

        // The precondition, stated: without it this suite would be asserting the reshape path.
        #expect(scoped.table.scroller?.documentView?.frame.height == height)
        let reading = try #require(scoped.feed.reading())
        #expect(deck.lane.geometry.documentHeight == MinimapGeometry(
            reading,
            lane: deck.lane.bounds.size,
        ).documentHeight)
    }

    @Test
    func `a feed scoped onto a subagent is the reading the lane maps`() async throws {
        let deck = await MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        deck.lane.layoutSubtreeIfNeeded()

        let scoped = await Self.rescope(deck, onto: Self.delegated())

        let reading = try #require(scoped.feed.reading())
        #expect(scoped.table.scroller === scoped.feed.scroller)
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
    func `the lane beside a scoped feed maps that subagent's reading`() async throws {
        let deck = HostedDeck()
        await deck.settled()
        for _ in 0 ..< 12 {
            await deck.grow()
        }

        for subagent in ["a-one", "a-two", "a-one"] {
            try await deck.scope(onto: subagent)
            let reading = try #require(deck.coordinator.reading())
            let lane = try deck.lane
            #expect(lane.geometry.documentHeight == MinimapGeometry(
                reading,
                lane: lane.bounds.size,
            ).documentHeight, "The lane is not mapping \(subagent).")
        }
    }
}
