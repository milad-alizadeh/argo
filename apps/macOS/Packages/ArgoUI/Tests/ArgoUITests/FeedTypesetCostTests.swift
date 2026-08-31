import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// What a prose row's height COSTS, against what the same row costs laid out for real.
///
/// The gate on #856's remaining half. `FeedRemeasureCostTests` holds the COUNT of measurements a
/// pass makes; nothing held what one of them costs, and the count is already as low as it goes. The
/// minimap is a miniature of the whole document, so every row of a 4 000-row reading has to have a
/// height whether anybody has looked at it or not — the only way left is a cheap measurement.
///
/// Every budget is a ratio of two figures taken in the SAME run (ADR-0028 Rule 7), and the typeset
/// walk runs FIRST in each of them: it leaves `ProseReading`'s stores warm, so the ruler it is
/// compared against never pays a markdown read that the typeset side did. The bias is against the
/// claim, which is the only direction a cost gate may be biased in.
///
/// Recorded on this machine (Apple M-series, macOS 26, debug ArgoUI test bundle, idle; 4 000 rows
/// built from the projection's own long fixture with every text made distinct, so no store answers
/// a question a real cold walk would pay for): a prose row measured against the ruler cost 486 µs
/// and typeset 168 µs, a ratio of 2.90; a whole-document walk over 4 000 prose rows cost 0.502 s
/// against the same document's 1.201 s through the ruler, a ratio of 0.42. The budgets below are
/// floors under those figures, not restatements of them.
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

    /// Every row measured the way `FeedRowMeasure` measures one.
    private static func typeset(_ rows: [FeedRow], across measure: CGFloat) -> Double {
        cpuSeconds {
            for at in rows.indices {
                _ = FeedRowMeasure.height(
                    of: rows[at].content,
                    chip: FeedCopy.drawsChip(of: rows, at: at),
                    across: measure,
                )
            }
        }
    }

    /// Every row measured the way the ruler measures one — the same tree, the same call, one
    /// controller for the one shape these rows are.
    private static func laidOut(_ rows: [FeedRow], atWidth width: CGFloat) -> Double {
        let model = FeedTableFixture.model(showing: rows)
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        return cpuSeconds {
            for at in rows.indices {
                ruler.rootView = model.content(at: at)
                _ = ruler.sizeThatFits(
                    in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
                ).height
            }
        }
    }

    /// A whole-document measure at the length a real transcript reaches, against the same document
    /// laid out for real. Half, and 0.42 is what it reads — a floor, not a tolerance to widen.
    @Test
    func `a whole-document measure of four thousand rows costs half of laying them out`() {
        let rows = Self.prose(Self.rows)
        ProseReading.holding(rows: rows.count)
        let width = Self.pane.width
        let typeset = Self.typeset(rows, across: FeedRowMeasure.measure(atWidth: width))
        let laidOut = Self.laidOut(rows, atWidth: width)

        #expect(typeset < laidOut / 2)
    }

    /// The per-row claim, on the rows a reader actually meets: one prose row typeset costs a
    /// fraction of the same row laid out. It reads 2.90× here.
    @Test
    func `one prose row typeset costs a fraction of the same row laid out`() {
        let rows = Self.prose(600)
        ProseReading.holding(rows: rows.count)
        let width = Self.pane.width
        let typeset = Self.typeset(rows, across: FeedRowMeasure.measure(atWidth: width))
        let laidOut = Self.laidOut(rows, atWidth: width)

        #expect(typeset * 2 < laidOut)
    }

    /// The routing itself, counted rather than timed: a reading of nothing but prose reaches the
    /// ruler for no row at all, and a mixed one reaches it for exactly the rows Core Text declined.
    @Test
    func `a prose reading is measured without one layout pass`() {
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(Self.prose(300), in: Self.pane, through: handle)
        let table = coordinator.table
        coordinator.dropMeasuredHeights()
        let before = coordinator.layouts
        for at in 0 ..< 300 {
            _ = table.map { coordinator.measuredHeight(at: at, in: $0) }
        }

        #expect(coordinator.measurements >= 300)
        #expect(coordinator.layouts == before)
    }

    @Test
    func `a mixed reading reaches the ruler for the rows Core Text declined`() {
        let rows = FeedProjection.longRows
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(rows, in: Self.pane, through: handle)
        let table = coordinator.table
        coordinator.dropMeasuredHeights()
        let before = coordinator.layouts
        var declined = 0
        for at in rows.indices {
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
