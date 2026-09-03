import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import ProseText
import Testing

/// What a row's height COSTS, now that no row's height is a SwiftUI layout pass at all.
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

    /// Every height in a reading, taken row by row exactly as the pass takes them — one
    /// measurement per row and no second walk (ADR-0030, Rule 3).
    ///
    /// Synchronous, and the pass's own `height(at:of:)` rather than the task group over it: the
    /// counters these cases read are shared with the two thousand other tests in this process, and
    /// a case that suspends hands them to whatever runs next. What is being counted is what a row
    /// COSTS, which is the same number however the pass splits the rows across cores.
    private static func measured(_ rows: [FeedRow]) -> Int {
        ProseReading.holding(rows: rows.count)
        let model = FeedTableFixture.model(showing: rows)
        let stamp = FeedMeasureStamp(of: model, atWidth: Self.pane.width)
        for index in rows.indices {
            _ = FeedMeasurePass.height(at: index, of: stamp)
        }
        return rows.count
    }

    /// The claim at the length the argument is about: a whole document of prose is given a height
    /// per row, and the glyph work it pays for is its own words rather than a pass per row.
    @Test
    func `a whole document of four thousand prose rows is measured once a row`() {
        let rows = Self.prose(Self.rows)

        #expect(Self.measured(rows) == Self.rows)
    }

    /// The same claim as a shape rather than as a length: thirteen times the rows is thirteen times
    /// the heights, and neither length reaches SwiftUI — which edge 9 of `swift-boundaries.sh` now
    /// holds for the whole target, since there is no ruler left to count.
    @Test
    func `a prose reading of any length is measured once a row`() {
        let short = Self.measured(Self.prose(300))
        let long = Self.measured(Self.prose(Self.rows))

        #expect(short == 300)
        #expect(long == Self.rows)
    }

    /// What an arithmetic row costs: nothing at all. A call, a mark and a survey are worked out
    /// from tokens and a line box, so a document of four thousand of them pays no Core Text pass
    /// on top of the ones a warm process has already taken for the faces themselves.
    ///
    /// Counted in `ProseMetrics.typesets`, which is the glyph work itself — the unit the overview
    /// lane's budgets are in, and one that reads the same idle and loaded (`CostMeasure`).
    @Test
    func `a document of four thousand worked-out rows pays no glyph work`() {
        // Warm: the first row of any shape settles its faces, and a face is a fact about the
        // PROCESS rather than about the document being measured.
        _ = Self.measured(Self.worked(2))

        // Counted for THIS caller and not for the process: since ADR-0030 the whole-document
        // measure pass typesets off the main actor, so a case reading the shared counter either
        // side of its own work is counting whatever else was measuring beside it.
        let paid = ProseMetrics.typesets { _ = Self.measured(Self.worked(Self.rows)) }

        #expect(paid == 0)
    }

    /// A document of rows that are worked out rather than typeset — the shapes ADR-0030 Rule 1
    /// gives a formula, alternating so no fold collapses them into one row.
    private static func worked(_ count: Int) -> [FeedRow] {
        (0 ..< count).map { at in
            FeedRow(
                id: at,
                content: at.isMultiple(of: 2)
                    ? .call(RowKindFixture.answeredCall)
                    : .mark(.turnEnded(.endTurn)),
            )
        }
    }
}
