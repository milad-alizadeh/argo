import ArgoAtoms
import ArgoDesign
@testable import ArgoUI
import CoreGraphics
import Testing

/// What the way-back-to-the-newest control's measures claim, now that it carries no word.
///
/// The control shares the deck's bottom edge with the plan pill and carries no label, so what it
/// measures against is the OTHER float and the pointer — not the feed it sits over.
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

    /// It clears the pill entirely rather than sitting beside it — the claim `tailLift` exists for.
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

    /// The chip is at least a line of its own type plus the inset either side, so the number in it
    /// is never cut by the shape around it.
    @Test
    func `the chip clears the line of type it carries`() {
        #expect(ArgoBadge.height >= ArgoBadge.type.size + ArgoBadge.insetY * 2)
    }

    /// A second digit widens the capsule rather than crowding the first. Nothing bounds the count,
    /// so the shape has to take whatever arrives.
    @Test
    func `a second digit gets room rather than a tighter one`() {
        #expect(ArgoBadge.insetX > 0)
    }
}
