import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// What recycling by shape buys, and the claim that it is still being done (ADR-0028 Rules 1 and
/// 7).
///
/// A hosting view handed a different view tree tears its own down and builds the new one; handed
/// the same tree with fresh values it diffs. The reading's rows alternate between shapes
/// constantly, so a single pool hands almost every recycled cell the wrong tree — and that build is
/// what a scroll pays per row it exposes, and what the ruler pays per row on every re-measure.
///
/// Both halves of the split get a claim here, because they are separate mechanisms that fail
/// separately: the cells recycle by shape, and the rulers are kept by shape.
@Suite("Feed row shape")
@MainActor
struct FeedRowShapeTests {
    private static let column = CGSize(width: 620, height: 800)

    @Test
    func `every content case names the tree its row builds`() {
        // One shape per branch of `FeedRowView.body`, so no two cases may answer the same one.
        let cases: [FeedRow.Content] = [
            .prompt(text: "asked", shots: []),
            .message("said"),
            .thought("reasoned"),
            .mark(.working),
        ]
        #expect(Set(cases.map(\.shape)).count == cases.count)
        #expect(FeedRow.Content.message("said").shape == .message)
        #expect(FeedRow.Content.mark(.working).shape == .mark)
    }

    /// The identifier really is a function of the shape. Without this, a `reuse(_:)` that ignored
    /// its argument and returned one constant — the exact shape of the change being reverted —
    /// would leave every claim below green, since both sides of them are computed by `reuse`.
    @Test
    func `two shapes never share a pool`() {
        let identifiers = Set(
            [FeedRow.Content.Shape.prompt, .message, .call, .mark].map(FeedRowCell.reuse),
        )
        #expect(identifiers.count == 4)
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
        // The fixture is the shipping projection, so this states what it actually covers: it holds
        // no gallery, skill-load, ask or unreadable row, and those four go unexercised here.
        #expect(seen.count >= 5)
    }

    /// The ruler half, which no assertion about heights can make: a reading measured through one
    /// controller lands on exactly the same heights and costs twice as much.
    ///
    /// One ruler per shape the reading LAYS OUT, which since `FeedRowMeasure` is no longer every
    /// shape it holds: a prose row is typeset from Core Text, so it builds no tree and needs no
    /// controller. Named as the shapes Core Text declined rather than as a count, so a shape that
    /// quietly stopped being recycled fails here, and so does one that quietly started being
    /// typeset without a height claim beside it.
    @Test
    func `a reading is measured through one ruler per shape it lays out`() {
        let rows = FeedProjection.longRows
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(rows, in: Self.column, through: handle)
        let measure = FeedRowMeasure.measure(atWidth: Self.column.width)
        let laidOut = Set(
            rows
                .filter {
                    FeedRowMeasure.height(of: $0.content, chip: false, across: measure) == nil
                }
                .map(\.content.shape),
        )

        // The fixture measures every row on the way in, so every shape it lays out has a ruler.
        #expect(coordinator.rulerShapes == laidOut)
        #expect(Set(rows.map(\.content.shape)).subtracting(laidOut) == [.message, .thought])
        #expect(coordinator.rulerShapes.count >= 4)
    }

    /// The cost, as a RATIO between two arms measured in the same run — a wall-clock budget would
    /// measure the machine (see `CostMeasure`), and the arms move together on any box.
    ///
    /// This one measures the framework rather than the feed: it is what says the split is worth
    /// keeping at all, and `a reading is measured through one ruler per shape it holds` is what
    /// says the feed is still taking it. Recorded on the shipping fixture at 1.81; gated at 1.4.
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
