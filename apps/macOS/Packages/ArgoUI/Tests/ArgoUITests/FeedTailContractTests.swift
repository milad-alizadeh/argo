@testable import ArgoUI
import CoreGraphics
import Testing

/// What the way-back-to-the-newest control's measures claim, now that it carries no word.
///
/// Its own suite for the reason `PlanPillContractTests` is one: the claims are about a
/// relationship. The control shares the deck's bottom edge with the plan pill and lost the label
/// that used to size it, so what it measures against is the OTHER float and the pointer — not the
/// feed it sits over.
@Suite("The feed's tail control")
struct FeedTailContractTests {
    /// The smallest a pointer target may be on macOS. A control that is only a mark has no words
    /// to grow it, so nothing else stops the circle from shrinking to its glyph.
    private let pointerTarget: CGFloat = 28

    @Test
    func `the circle is a target rather than a glyph with a ring round it`() {
        #expect(ArgoFeedRow.tailDiameter >= pointerTarget)
        #expect(ArgoFeedRow.tailDiameter > ArgoIconSize.control.rawValue)
    }

    /// Two floats over one edge, at one measure. Stacked rather than side by side (`tailLift`),
    /// and a circle drawn to a size of its own would read as a second, unrelated lane.
    @Test
    func `it is drawn to the lane the plan pill already occupies`() {
        #expect(ArgoFeedRow.tailDiameter == ArgoPlanPill.laneHeight)
    }

    /// It clears the pill entirely rather than sitting beside it — the claim `tailLift` exists to
    /// make, restated against the circle now that the control's own height is a token too.
    @Test
    func `it floats clear of the plan pill's whole lane`() {
        #expect(ArgoFeedRow.tailLift > ArgoPlanPill.lift + ArgoPlanPill.laneHeight)
    }
}
