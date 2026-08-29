import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// What recycling by shape buys, and the claim that it is still being done (ADR-0028 Rules 1 and
/// 7).
///
/// A hosting view handed a different view tree tears its own down and builds the new one; handed
/// the
/// same tree with fresh values it diffs. The reading's rows alternate between shapes constantly, so
/// a single pool hands almost every recycled cell the wrong tree — and that build is what a scroll
/// pays per row it exposes, and what the ruler pays per row on every re-measure.
@Suite("Feed row shape")
@MainActor
struct FeedRowShapeTests {
    private static let column = CGSize(width: 620, height: 800)

    @Test
    func `every content case names the tree its row builds`() {
        // Each case answers, and the two that build one view share one shape.
        #expect(FeedRow.Content.message("said").shape == .prose)
        #expect(FeedRow.Content.thought("reasoned").shape == .prose)
        #expect(FeedRow.Content.prompt(text: "asked", shots: []).shape == .prompt)
        #expect(FeedRow.Content.mark(.working).shape == .mark)
    }

    @Test
    func `a cell is recycled only onto a row of its own shape`() throws {
        let rows = FeedProjection.longRows
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(rows, in: Self.column, through: handle)
        let table = try #require(coordinator.table)

        // Every cell the table hands back carries its own shape's identifier, so AppKit's pool can
        // never offer a call's cell to a mark.
        var seen: Set<FeedRow.Content.Shape> = []
        for index in rows.indices {
            let shape = rows[index].content.shape
            let cell = coordinator.tableView(table, viewFor: nil, row: index) as? FeedRowCell
            #expect(try #require(cell).identifier == FeedRowCell.reuse(shape))
            seen.insert(shape)
        }
        // The fixture is the shipping projection, so this states what it actually covers.
        #expect(seen.count >= 5)
    }

    /// The cost, as a RATIO between two arms measured in the same run — a wall-clock budget would
    /// measure the machine (see `CostMeasure`), and the arms move together on any box.
    ///
    /// Recorded on the shipping fixture: 140 ms through one controller against 73 ms through one
    /// per
    /// shape, a ratio of 1.92. Gated at 1.4 to leave room for a quieter or busier machine without
    /// letting the split silently stop paying.
    @Test
    func `measuring by shape costs less than measuring through one ruler`() {
        let rows = FeedProjection.longRows
        let model = FeedTableFixture.model(showing: rows)

        func ruler() -> NSHostingController<AnyView> {
            let made = NSHostingController(rootView: AnyView(EmptyView()))
            made.sizingOptions = []
            return made
        }
        func fit(_ controller: NSHostingController<AnyView>) {
            _ = controller.sizeThatFits(
                in: NSSize(width: Self.column.width, height: .greatestFiniteMagnitude),
            )
        }

        // One controller for the whole reading — what the feed did before the split.
        let shared = leastCPUSeconds(trials: 3) {
            let one = ruler()
            for index in rows.indices {
                one.rootView = model.content(at: index)
                fit(one)
            }
        }
        // One per shape, which is what `FeedTableCoordinator` now keeps.
        let split = leastCPUSeconds(trials: 3) {
            var rulers: [FeedRow.Content.Shape: NSHostingController<AnyView>] = [:]
            for index in rows.indices {
                let shape = rows[index].content.shape
                let one = rulers[shape] ??
                    { let made = ruler(); rulers[shape] = made; return made }()
                one.rootView = model.content(at: index)
                fit(one)
            }
        }

        #expect(split > 0)
        #expect(shared / split >= 1.4, "one ruler \(shared)s, one per shape \(split)s")
    }
}
