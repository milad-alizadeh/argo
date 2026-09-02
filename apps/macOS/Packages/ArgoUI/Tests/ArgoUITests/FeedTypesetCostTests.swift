import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a prose row's height COSTS, counted in the SwiftUI layout passes it did not need.
///
/// The gate on #856's remaining half. `FeedRemeasureCostTests` holds the COUNT of measurements a
/// pass makes; nothing held what one of them costs, and the count is already as low as it goes. The
/// minimap is a miniature of the whole document, so every row of a 4 000-row reading has to have a
/// height whether anybody has looked at it or not — the only way left is a cheap measurement.
///
/// So the unit is a layout pass, which is the same unit `FeedRemeasureCostTests` counts in and for
/// the same reason: one measurement through the ruler is one full SwiftUI layout pass, and that
/// pass is the whole of the expense. A reading of nothing but prose takes 4 000 heights and pays
/// none of them, which is not a redirection but the saving itself, said exactly.
///
/// **This suite used to gate a CPU ratio, and neither form of it could be made sound.** It divided
/// a Core Text typeset walk by an `NSHostingController` walk and asserted the quotient under 0.5;
/// it read 0.42 idle and failed 3 of 4 isolated runs at load average 130. Two different KINDS of
/// work inflate by uncorrelated factors under load, so the quotient reads the machine
/// (`cpuSeconds`, and `MinimapWalkCostTests` for the flake that established it). The same-kind
/// repair Rule 3 asks for does not rescue it either: typeset per row at 4 000 rows against typeset
/// per row at 300, warm, reads 3.98 to 4.10 over four trials — the 4 000-row working set does not
/// fit the caches the 300-row one does, so even that ratio is a fact about memory rather than about
/// the routing. Cold it reads 0.92 to 1.04, and cold is a single run that cannot be taken as the
/// least of several. There is no sound ratio here, and `ProseCacheCostTests` already holds the
/// cliff a cold walk would have been watching for.
///
/// Recorded on this machine (Apple M-series, macOS 26, debug ArgoUI test bundle, idle; 4 000 rows
/// built from the projection's own long fixture with every text made distinct, so no store answers
/// a question a real cold walk would pay for): a prose row measured against the ruler cost 486 µs
/// and typeset 168 µs; a whole-document walk over 4 000 prose rows cost 0.502 s against the same
/// document's 1.201 s through the ruler. Recorded figures, gated by nothing — the counts below are
/// the gates, and a count is exactly the same idle and loaded.
@MainActor
@Suite("Feed typeset cost")
struct FeedTypesetCostTests {
    private static let pane = CGSize(width: 460, height: 300)
    private static let rows = 4000

    /// A document of prose, every text distinct — a reading in which no cache can answer a question
    /// the real one would pay for, which is what a cold walk over a real transcript is.
    private static func prose(_ count: Int) -> [FeedRow] {
        let base = FeedProjection.longRows.compactMap { row -> String? in
            guard case let .message(text) = row.content else { return nil }
            return text
        }
        return (0 ..< count).map { at in
            FeedRow(id: at, content: .message("\(base[at % base.count]) [\(at)]"))
        }
    }

    /// Every height in a reading taken again, from a store that has just been emptied.
    private static func remeasured(_ rows: [FeedRow]) -> FeedTableCoordinator {
        let coordinator = FeedTableFixture.laidOut(rows, in: Self.pane, through: FeedTableHandle())
        coordinator.dropMeasuredHeights()
        let table = coordinator.table
        for at in rows.indices {
            _ = table.map { coordinator.measuredHeight(at: at, in: $0) }
        }
        return coordinator
    }

    /// The claim at the length the argument is about: a whole document of prose is given a height
    /// per row and costs not one SwiftUI layout pass to do it. The old CPU ratio said this in
    /// seconds over the same 4 000 rows; this says it in the passes those seconds were.
    @Test
    func `a whole document of four thousand prose rows costs no layout pass`() {
        let rows = Self.prose(Self.rows)
        ProseReading.holding(rows: rows.count)
        let coordinator = Self.remeasured(rows)

        #expect(coordinator.measurements >= Self.rows)
        #expect(coordinator.layouts == 0)
    }

    /// The same claim as a shape rather than as a length: thirteen times the rows is thirteen times
    /// the heights and still no layout pass at all. O(0), which is the only bound on a cost that
    /// cannot be paid.
    @Test
    func `a prose reading of any length reaches the ruler for no row`() {
        let short = Self.remeasured(Self.prose(300))
        let long = Self.remeasured(Self.prose(Self.rows))

        #expect(short.measurements >= 300)
        #expect(long.measurements >= Self.rows)
        #expect(short.layouts == 0)
        #expect(long.layouts == 0)
    }

    @Test
    func `a mixed reading reaches the ruler for the rows Core Text declined`() {
        let rows = FeedProjection.longRows
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        let table = coordinator.table
        let before = coordinator.layouts
        var declined = 0
        for at in rows.indices {
            // Emptied per row, not once: a height is filed under what it is a fact ABOUT
            // (`FeedGeometry.Ground`), so two rows of this reading that draw alike are one entry
            // and the second of them reaches nothing. The claim here is about the ROUTING, which
            // is a question asked of each row cold.
            coordinator.dropMeasuredHeights()
            _ = table.map { coordinator.measuredHeight(at: at, in: $0) }
            declined += FeedRowMeasure.height(
                of: rows[at].content,
                chip: FeedCopy.drawsChip(of: rows, at: at),
                across: FeedRowMeasure.measure(atWidth: Self.pane.width),
            ) == nil ? 1 : 0
        }

        #expect(coordinator.layouts - before == declined)
        #expect(declined < rows.count)
    }
}
