import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

// The same claim over a whole SHIPPING reading rather than over one row at a time.
//
// The corpus beside this one is a shape at a time, stated by hand, which is what makes a failure
// point at a formula. This is the other half: every row the projection really produces, in the
// order it produces them, so a shape whose height depends on the row ABOVE it — or on a fold, a
// chip, a Turn boundary — is measured in the company it keeps rather than alone.

extension FeedShapeHeightTests {
    @Test(arguments: [CGFloat(460), 1000])
    func `every row of a shipping reading stands where the ruler lays it out`(width: CGFloat) {
        for rows in [FeedProjection.previewRows, FeedProjection.longRows] {
            Self.holds(rows, at: width)
        }
    }

    /// Every row of one reading, worked out against drawn — the whole row this time, the step above
    /// it included, because that step is inside the height the table asks for.
    private static func holds(_ rows: [FeedRow], at width: CGFloat) {
        let model = FeedTableFixture.model(showing: rows)
        let stamp = FeedMeasureStamp(of: model, atWidth: width)
        let measure = FeedRowMeasure.measure(atWidth: width)
        for at in rows.indices {
            let standing = stamp.standing(at: at)
            let step = FeedRow.step(to: rows[at], from: at > 0 ? rows[at - 1] : nil)
            let worked = step + FeedShapeHeight(standing: standing, measure: measure)
                .height(of: rows[at].content)
            let drawn = Self.drawn(model, at: at, across: width)
            let told = "row \(at) (\(rows[at].content.shape)) at \(width): "
                + "worked out \(worked), drawn \(drawn)"
            #expect(ceil(worked) == ceil(drawn), "\(told)")
        }
    }

    /// What SwiftUI lays one row of that reading out at.
    private static func drawn(_ model: FeedTableModel, at index: Int, across width: CGFloat)
        -> CGFloat {
        let ruler = NSHostingController(rootView: model.content(at: index))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        return ruler.sizeThatFits(
            in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }
}
