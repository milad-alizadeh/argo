import AppKit
@testable import ArgoUI
import Testing

/// What the reading changing shape costs the lane beside it.
///
/// The lane's geometry is a walk over every row, and the document view posts a frame change for
/// every `setFrame` — including the burst a measure tail makes, which is exactly when the geometry
/// is known to be in flux. A handler decides; it does not compute (#955, ADR-0028 Rule 2).
@Suite("Minimap reshape")
@MainActor
struct MinimapReshapeTests {
    private static func postReshape(on deck: MinimapLaneFixture.Mounted) throws {
        let document = try #require(deck.table.scroller?.documentView)
        NotificationCenter.default.post(
            name: NSView.frameDidChangeNotification, object: document,
        )
    }

    @Test
    func `a document frame notification carrying no reshape derives no lane geometry`() throws {
        let deck = MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        // Settled first: the reading a fixture opens really does reshape as its rows are measured,
        // and the claim here is about the notices that arrive once it has stopped.
        deck.lane.layoutSubtreeIfNeeded()
        let derived = deck.lane.geometryDerivations

        for _ in 0 ..< 5 {
            try Self.postReshape(on: deck)
        }
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.geometryDerivations == derived)
    }

    /// ADR-0028's acceptance line for the lane: the reader travelling over a document that did not
    /// change shape rebuilds no geometry at all. The rectangle still moves — that is a layer frame,
    /// not a walk over the rows.
    @Test
    func `scrolling a settled reading rebuilds no lane geometry`() {
        let deck = MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        deck.lane.layoutSubtreeIfNeeded()
        let derived = deck.lane.geometryDerivations
        let atRest = deck.lane.viewportFrame

        for at in stride(from: CGFloat(0), to: 3000, by: 200) {
            deck.feed.settle(at: at, over: nil)
        }
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.geometryDerivations == derived)
        #expect(deck.lane.viewportFrame != atRest)
    }

    /// A reading that really did reshape is still mapped — once, at the next layout, however many
    /// notices the reshape posted.
    @Test
    func `a reading that grows derives the lane geometry once`() throws {
        let deck = MinimapLaneFixture.mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        let mapped = deck.lane.geometry.documentHeight
        let derived = deck.lane.geometryDerivations

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))
        for _ in 0 ..< 5 {
            try Self.postReshape(on: deck)
        }
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.geometryDerivations == derived + 1)
        #expect(deck.lane.geometry.documentHeight > mapped)
    }
}
