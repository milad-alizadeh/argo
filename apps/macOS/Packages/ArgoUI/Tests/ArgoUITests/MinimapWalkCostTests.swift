import AppKit
@testable import ArgoUI
import Testing

/// What a whole-document READING costs the lane, as distinct from a geometry derivation.
///
/// A derivation is arithmetic over rows already read. A reading is a `MinimapRow` per row of the
/// document — a `ProseReading.structure` each — plus a full ruler measure for every height the feed
/// does not already know, which is the expensive half by two orders of magnitude. `refresh()` used
/// to do both every time, so a pass that only resized the lane re-read the document, and a pass
/// inside a width burst re-measured all of it at burst rate.
///
/// `MinimapReshapeTests` holds the derivation count, and it holds it over a fixture that never lays
/// the lane out while the measure tail runs — so it reads one derivation for a burst the running
/// app pays per batch. `pumping` is what the app has: a layout pass every turn of the run loop, for
/// as long as the pass behind it is measuring.
///
/// Recorded over the 1000-row reading below, before → after: a mount 2 → 1 walks at 1000 ruler
/// measures either way; a full `.all` re-measure 7 → 1 walks; a 30-notice reshape burst carrying no
/// reshape 0 → 0 walks. The width burst's own figures, and the seconds beside them, are
/// `PerfBudgets.walkBurstDocuments` (#953). Every gate below is a COUNT, which is the only figure
/// that is exactly the same idle and loaded — see the width-burst case for the ratio that was tried
/// here and why it could not be made sound.
@Suite("Minimap walk cost")
@MainActor
struct MinimapWalkCostTests {
    /// A real transcript's length — the 987-row Session the 21.7 s settle was measured over.
    private static let long = Self.rows(1000)
    /// A quarter of it, for the claim that says the same thing as a shape rather than as a number.
    private static let short = Self.rows(250)
    /// How many frames of a seam drag one burst is.
    private static let frames = 30

    private static func rows(_ count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
        }
    }

    /// A mount left until the feed has a settled document to be mapped. The lane is laid out
    /// after the wait, as it is in the app.
    private static func settled(over rows: [FeedRow]) async -> MinimapLaneFixture.Mounted {
        let deck = await MinimapLaneFixture.mounted(over: rows)
        await FeedTableFixture.settled(deck.table)
        deck.lane.layoutSubtreeIfNeeded()
        return deck
    }

    /// A layout pass per turn of the run loop, which is what the lane gets in the app and what the
    /// reshape fixture leaves out.
    private static func pumping(
        _ lane: MinimapLaneView,
        _ work: () async throws -> Void,
    ) async throws {
        let pump = Task { @MainActor in
            while !Task.isCancelled {
                lane.layoutSubtreeIfNeeded()
                try? await Task.sleep(for: .milliseconds(1))
            }
        }
        defer { pump.cancel() }
        try await work()
    }

    /// One seam let go over `rows`, and what the lane read for the burst of batches it made.
    private static func walksAcrossAReMeasure(over rows: [FeedRow]) async throws -> Int {
        let deck = await MinimapLaneFixture.mounted(over: rows)
        let scroller = try #require(deck.table.scroller)
        deck.lane.layoutSubtreeIfNeeded()
        let walked = deck.lane.readingWalks
        let noticed = deck.lane.reshapeNotices

        scroller.frame = NSRect(x: 0, y: 0, width: 240, height: MinimapLaneFixture.column.height)
        deck.table.settleAfterResize()
        try await Self.pumping(deck.lane) {
            await FeedTableFixture.settled(deck.table)
        }
        deck.lane.layoutSubtreeIfNeeded()

        // The burst really was one: a lane that read per notice would read many times over.
        #expect(deck.lane.reshapeNotices - noticed > 1)
        return deck.lane.readingWalks - walked
    }

    /// The gate ADR-0028 Rule 2 asks for, in walks rather than in derivations: a `.all` pass
    /// measures a batch a run-loop turn, and the lane is laid out on every one of those turns. One
    /// reading for the pass, not one per batch.
    @Test
    func `a full re-measure is read once, not once per batch`() async throws {
        #expect(try await Self.walksAcrossAReMeasure(over: Self.long) <= 1)
    }

    /// The same claim said as a shape: four times the rows is four times the batches, and still the
    /// same number of readings. O(1), not O(rows / batch).
    @Test
    func `a re-measure four times as long is read no more often`() async throws {
        let short = try await Self.walksAcrossAReMeasure(over: Self.short)
        let long = try await Self.walksAcrossAReMeasure(over: Self.long)

        #expect(long == short)
    }

    /// The seam under the reader's hand, which is where the 21.7 s lived. Every width frame retires
    /// every measured height, and the feed answers by measuring what the reader can see and
    /// deferring the rest — so a lane that read the whole document per frame re-measured all of it
    /// per frame.
    ///
    /// Three counts, and deliberately no CPU figure. This case used to divide the burst's thread
    /// CPU by one cold reading's and gate the quotient at 3x. Over 24 runs of unchanged code that
    /// quotient read 1.85 to 3.14 and failed 1 in 10 under load, while every count below stayed
    /// EXACT — 1 420 measures and 1 derivation, every run, idle or loaded.
    ///
    /// It could not be tightened either, because nothing was wrong with the coverage: all 1 420
    /// measures already fell inside the timed blocks. The measure itself was unsound. Thread CPU
    /// drops the time the scheduler took the thread away but still counts the cycles it stalled
    /// while on-core, so it is load-independent only for compute-bound work at a steady clock — see
    /// `cpuSeconds`. The burst is thirty fragments of AppKit layout, each resumed after a run-loop
    /// turn; the cold reading is one continuous streaming walk. Different memory profiles,
    /// different core and clock, so the halves inflate by uncorrelated factors and the QUOTIENT
    /// moves while the work does not. A ratio needs its halves to do the same KIND of work, which
    /// is what Rule 3's two-fixture shape gives and this never had.
    ///
    /// So the CPU half went and a count took its place. The claim it was making is the first count
    /// below; the claim it was standing in for is the third.
    @Test
    func `a width burst re-measures less than one document`() async throws {
        let deck = await Self.settled(over: Self.long)
        let scroller = try #require(deck.table.scroller)
        let walked = deck.lane.readingWalks
        let measured = deck.table.measurements
        let derived = deck.lane.geometryDerivations

        for at in 0 ..< Self.frames {
            Self.narrow(deck, scroller, by: at)
            // A frame of a drag is a turn of the run loop. Without one, the deferred pass the feed
            // arms never starts and the burst is not the burst the app has.
            try await Task.sleep(for: .milliseconds(1))
        }

        // Thirty frames of drag cost under three documents' worth of ruler measures, where they
        // used to cost twenty-nine — one per frame. What is left is the feed's own pass over the
        // rows the reader can SEE, 47 of them a frame, which is the work the degrade-then-settle
        // design chooses to pay; the reading is `PerfBudgets.walkBurstDocuments`.
        #expect(deck.table.measurements - measured
            < PerfBudgets.walkBurstDocuments * Self.long.count)
        #expect(deck.lane.readingWalks - walked <= 1)
        // And the geometry is derived once for the whole burst, not once a frame. This is the half
        // no other count here can see: a derivation is arithmetic over rows already read, so a lane
        // that rebuilt whole-document geometry every frame would move neither of the two counts
        // above. Recorded at 1 over thirty frames.
        #expect(deck.lane.geometryDerivations - derived <= 1)
    }

    /// One frame of the seam moving: the lane narrows and the reading beside it widens by the same
    /// points, and the lane is laid out against both.
    private static func narrow(
        _ deck: MinimapLaneFixture.Mounted,
        _ scroller: NSScrollView,
        by points: Int,
    ) {
        deck.lane.setFrameSize(CGSize(
            width: MinimapLaneFixture.width - CGFloat(points), height: deck.lane.bounds.height,
        ))
        scroller.setFrameSize(CGSize(
            width: MinimapLaneFixture.column.width + CGFloat(points),
            height: scroller.bounds.height,
        ))
        deck.lane.layoutSubtreeIfNeeded()
    }

    /// The lane resizing on its own — a seam let go, a panel settled — re-derives the geometry off
    /// the reading it holds and does not re-read the document. The derivation is what the rects are
    /// built from, so it still has to happen: this is the pair of counts that says which is which.
    @Test
    func `a lane that only resized derives without reading`() async {
        let deck = await Self.settled(over: Self.long)
        // Brought up to date first, so what follows is a pass over a document the lane has read —
        // not a pass that happened to catch one it had not.
        deck.lane.refresh()
        let walked = deck.lane.readingWalks
        let derived = deck.lane.geometryDerivations

        deck.lane.setFrameSize(CGSize(width: 60, height: deck.lane.bounds.height))
        deck.lane.refresh()

        #expect(deck.lane.readingWalks == walked)
        #expect(deck.lane.geometryDerivations == derived + 1)
    }
}
