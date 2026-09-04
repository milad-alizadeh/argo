@testable import AtlasLayout
import CoreGraphics
import Testing

/// The empty map is a map, not an absence — the one claim the placeholder plan makes, and the
/// reason `swift test` has something to report for this package at all.
@Suite("Atlas — the placeholder plan")
struct AtlasPlanTests {
    @Test func `empty plan stands on no ground`() {
        #expect(AtlasPlan.empty == AtlasPlan(extent: .zero))
    }

    @Test func `a plan keeps the extent it was given`() {
        // Both dimensions, because the two are the one place a width and a height can be swapped
        // and a square would not say so.
        let plan = AtlasPlan(extent: CGSize(width: 320, height: 180))
        #expect(plan.extent == CGSize(width: 320, height: 180))
    }
}
