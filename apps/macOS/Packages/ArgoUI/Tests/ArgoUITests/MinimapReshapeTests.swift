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
    /// How many notifications each claim posts — see `FeedPaneChangeTests.posted`.
    private static let posted = 5

    /// Several batches of the chunked re-measure long, so the tail below is a burst rather than one
    /// notice, and narrow enough that the drag really does re-wrap.
    private static let rows = (0 ..< 200).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    private static func postReshape(on deck: MinimapLaneFixture.Mounted) throws {
        let document = try #require(deck.table.scroller?.documentView)
        FeedTableFixture.postFrameChange(on: document)
    }

    @Test
    func `a document frame notification carrying no reshape derives no lane geometry`() throws {
        let deck = MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        // Settled first: the reading a fixture opens really does reshape as its rows are measured,
        // and the claim here is about the notices that arrive once it has stopped.
        deck.lane.layoutSubtreeIfNeeded()
        let derived = deck.lane.geometryDerivations

        for _ in 0 ..< Self.posted {
            try Self.postReshape(on: deck)
        }
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.geometryDerivations == derived)
    }

    /// A reading that really did reshape is still mapped — once, at the next layout, however many
    /// notices the reshape posted.
    @Test
    func `a reading that grows derives the lane geometry once`() throws {
        let deck = MinimapLaneFixture.mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        let mapped = deck.lane.geometry.documentHeight
        let derived = deck.lane.geometryDerivations

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))
        for _ in 0 ..< Self.posted {
            try Self.postReshape(on: deck)
        }
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.geometryDerivations == derived + 1)
        #expect(deck.lane.geometry.documentHeight > mapped)
    }

    /// The 227ms #955 measured, as a claim. A seam let go runs the chunked re-measure, and every
    /// batch of it changes the document's height — so the lane hears the reading reshape once per
    /// batch. It may rebuild its whole-document geometry once for the burst, not once per notice.
    @Test
    func `the tail of a full re-measure rebuilds the lane once, not once per batch`() async throws {
        #expect(try await Self.derivationsAcrossAReMeasure(over: Self.rows) == 1)
    }

    /// The same claim said as a shape rather than as a number (ADR-0028 Rule 2): a re-measure posts
    /// a notice per batch, so a lane deriving per notice costs O(rows / batch). Four times the rows
    /// is four times the batches and still one derivation.
    @Test
    func `a re-measure four times as long derives the lane no more often`() async throws {
        let long = (0 ..< 800).map {
            FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
        }

        #expect(try await Self.derivationsAcrossAReMeasure(over: long) == 1)
    }

    /// One seam let go over `rows`, and what the lane derived for the burst it made.
    private static func derivationsAcrossAReMeasure(over rows: [FeedRow]) async throws -> Int {
        let deck = MinimapLaneFixture.mounted(over: rows)
        let scroller = try #require(deck.table.scroller)
        deck.lane.layoutSubtreeIfNeeded()
        let derived = deck.lane.geometryDerivations
        let noticed = deck.lane.reshapeNotices

        scroller.frame = NSRect(x: 0, y: 0, width: 240, height: MinimapLaneFixture.column.height)
        deck.table.settleAfterResize()
        try await #require(deck.table.tailing).value
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.reshapeNotices - noticed > 1)
        return deck.lane.geometryDerivations - derived
    }

    /// The risk in coalescing, and the only one that matters: a burst whose LAST notice is dropped
    /// leaves the lane drawing a document that is not there any more, permanently and silently.
    ///
    /// So the pixels are compared — what the burst left against what an unconditional rebuild
    /// draws, and against a lane that never saw the old reading at all.
    @Test
    func `the rects a coalesced burst leaves are the rects a full rebuild draws`() throws {
        let deck = MinimapLaneFixture.mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        deck.lane.layoutSubtreeIfNeeded()

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))
        for _ in 0 ..< Self.posted {
            try Self.postReshape(on: deck)
        }
        deck.lane.layoutSubtreeIfNeeded()
        let coalesced = deck.lane.drawnRects

        // Derived again with nothing deferred, which is what a lane answering every notice would be
        // showing — and then against a lane opened on the grown reading from nothing.
        deck.lane.refresh()
        let fresh = MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        fresh.lane.layoutSubtreeIfNeeded()

        #expect(!coalesced.isEmpty)
        #expect(deck.lane.drawnRects == coalesced)
        #expect(fresh.lane.drawnRects == coalesced)
    }

    /// Deferring the rebuild must not be able to strand it. A reshape the lane could not answer —
    /// no reading to read, or a hand holding the geometry still — leaves the height unrecorded, so
    /// the next notice at that same height still lands.
    ///
    /// This holds the deferral, not the whole change: it fails if the handler records the height
    /// it merely heard about, which is what makes a bailed refresh permanent.
    @Test
    func `a notice the lane could not answer leaves the next one able to land`() throws {
        let deck = MinimapLaneFixture.mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        let scroller = try #require(deck.table.scroller)
        deck.lane.layoutSubtreeIfNeeded()
        let mapped = deck.lane.geometry.documentHeight
        let held = deck.lane.feed

        // The reading grows and settles at its new height with the lane unable to read it.
        deck.lane.feed = nil
        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))
        scroller.layoutSubtreeIfNeeded()
        deck.lane.layoutSubtreeIfNeeded()
        // And it can read it again — with no height left to change, so the only thing that can
        // bring the lane up to date is the notice it already had.
        deck.lane.feed = held
        try Self.postReshape(on: deck)
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.geometry.documentHeight > mapped)
    }
}
