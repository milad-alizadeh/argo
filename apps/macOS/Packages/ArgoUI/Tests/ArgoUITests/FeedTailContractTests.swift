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

    /// It clears the pill entirely rather than sitting beside it — the claim `tailLift` exists to
    /// make, restated against the circle now that the control's own height is a token too.
    @Test
    func `it floats clear of the plan pill's whole lane`() {
        #expect(ArgoFeedRow.tailLift > ArgoPlanPill.lift + ArgoPlanPill.laneHeight)
    }

    /// The badge is a mark ON the control and never a second control beside it. A chip as tall as
    /// the circle it hangs off stops reading as a count carried by the button and starts reading as
    /// two things floating over the same corner.
    @Test
    func `the count sits on the circle rather than rivalling it`() {
        #expect(ArgoBadge.height < ArgoFeedRow.tailDiameter)
    }

    /// Hung half off the edge, so half of it is still over the circle: a chip clear of the boundary
    /// is a second float, and one pulled fully inside covers the mark the control IS. It has room
    /// to hang there because the control floats in the feed's own gutter.
    @Test
    func `it hangs over the circle's edge without leaving the feed's gutter`() {
        #expect(ArgoBadge.height / 2 < ArgoFeedRow.inset)
    }

    /// One digit is a disc and two are a capsule — the minimum width IS the height, so a count
    /// never has to be cut to fit a shape decided before it arrived.
    @Test
    func `a single digit reads as a disc rather than as a squeezed capsule`() {
        #expect(ArgoBadge.height >= ArgoBadge.type.size + ArgoBadge.insetY * 2)
        #expect(ArgoBadge.insetX > 0)
    }
}
