import AppKit
import ArgoDesign
import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// Every row shape's arithmetic height against the height SwiftUI lays the same row out at.
///
/// This is the whole correctness of ADR-0030 Rule 1. A row measured a point short leaves a gap
/// under its last line and a point long overlaps the row below it, and nothing downstream can tell
/// either from a bug. So the ruler is still here — as the ORACLE, and only here:
/// `FeedTableCoordinator` no longer holds one, and no production path asks SwiftUI what a row
/// stands at.
///
/// Both are taken to the whole point the table asks its delegate for, which is what
/// `FeedTableCoordinator.measuredHeight` rounds every row up to — a formula that agreed to the
/// fraction and disagreed at the point would still draw a gap or an overlap, and one that disagrees
/// by a fraction inside the same point cannot.
///
/// Both numbers come from the shipping code and neither is a fixture. The drawn one is
/// `FeedTableModel.content(at:)` through a hosting controller, exactly as the table used to measure
/// a row; the worked-out one is what `FeedShapeHeight` answers, off the very model the tree is
/// built from, so a case cannot state a fold or an open row the drawn tree does not have.
///
/// Driven from `FeedRow.Content.Shape.allCases`: an eleventh shape with no case here fails
/// `every shape is held against the ruler` rather than escaping the suite.
@MainActor
@Suite("Feed shape heights")
struct FeedShapeHeightTests {
    /// The narrowest column the window allows, the deck's ordinary one, and one past the feed's own
    /// cap — so `ArgoFeedRow.column` is exercised rather than assumed.
    nonisolated static let widths: [CGFloat] = [ArgoLayout.feedMinimumWidth, 460, 1000]

    /// One row, and the state the reader has it in.
    struct Row {
        let name: String
        let content: FeedRow.Content
        var isUnfolded = false
    }

    @Test(arguments: widths)
    func `every shape stands where the ruler lays it out`(width: CGFloat) {
        for row in Self.rows {
            let model = Self.model(for: row)
            let standing = FeedMeasureStamp(of: model, atWidth: width).standing(at: 0)
            let worked = FeedShapeHeight(
                standing: standing,
                measure: FeedRowMeasure.measure(atWidth: width),
                tickets: .none,
            ).height(of: row.content)
            let drawn = Self.drawn(model, at: width)
            #expect(
                ceil(worked) == ceil(drawn),
                "\(row.name) at \(width): worked out \(worked), drawn \(drawn)",
            )
        }
    }

    /// The claim is worthless if a shape quietly stopped being covered.
    @Test
    func `every shape is held against the ruler`() {
        let held = Set(Self.rows.map(\.content.shape))
        #expect(held == Set(FeedRow.Content.Shape.allCases))
    }

    /// What SwiftUI lays the row out at, measured the way the table used to measure one.
    private static func drawn(_ model: FeedTableModel, at width: CGFloat) -> CGFloat {
        let ruler = NSHostingController(rootView: model.content(at: 0))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        return ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }

    /// The one row as the deck holds it, with the reader's state on it. Built here rather than
    /// through `FeedTableFixture`, because the open row is part of what a case states.
    private static func model(for row: Row) -> FeedTableModel {
        let focus = FocusState<FeedFocus?>()
        return FeedTableModel(
            rows: [FeedRow(id: 0, content: row.content)],
            selection: FeedRowSelection(
                open: .constant(nil),
                step: .constant(nil),
                lit: .constant(nil),
                focus: focus.projectedValue,
            ),
            held: nil,
            isResizing: false,
            bottomEdge: .bare,
            washed: nil,
            unfolded: .constant(row.isUnfolded ? [0] : []),
            environment: FeedCellEnvironment(),
        )
    }
}
