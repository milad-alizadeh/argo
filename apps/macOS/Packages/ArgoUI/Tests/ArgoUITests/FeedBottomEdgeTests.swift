import ArgoDesign
@testable import ArgoUI
import CoreGraphics
import Testing

/// What the reading's bottom edge owes whatever floats over it (#1225). One value answers for the
/// gutter under the last row, the fade over it and the way-back control's lift, so a float can
/// never be given room by one of the three and not by the others.
@Suite("The reading's bottom edge")
struct FeedBottomEdgeTests {
    @Test
    func `an edge with nothing over it asks for the feed's own gutter`() {
        #expect(FeedBottomEdge.bare.clearance == ArgoSpacing.section)
    }

    /// The defect: the pill floated over the edge and the rows under it were given no room for it,
    /// so the last row was read through the pill's glass.
    @Test
    func `a pill over the edge is cleared by the rows under it`() {
        let edge = FeedBottomEdge(hasPlanPill: true)

        #expect(edge.clearance >= ArgoPlanPill.footprint)
        #expect(edge.clearance > FeedBottomEdge.bare.clearance)
    }

    /// The pill rides on the vessel rather than beside it, so the two costs add.
    @Test
    func `a pill over a vessel costs the rows both`() {
        let edge = FeedBottomEdge(hasVessel: true, hasPlanPill: true)

        #expect(edge.clearance >= ArgoComposerVessel.feedClearance + ArgoPlanPill.footprint)
        #expect(edge.clearance > FeedBottomEdge(hasVessel: true).clearance)
    }

    @Test
    func `a vessel alone still costs the rows its whole float`() {
        #expect(FeedBottomEdge(hasVessel: true).clearance >= ArgoComposerVessel.feedClearance)
    }

    /// The way back to the newest row stacks ABOVE the two, never beside them: side by side, a
    /// narrow deck draws the centred pill and the trailing capsule on top of each other.
    @Test
    func `the way back floats clear of everything else at the edge`() {
        for edge in [
            FeedBottomEdge.bare,
            FeedBottomEdge(hasPlanPill: true),
            FeedBottomEdge(hasVessel: true),
            FeedBottomEdge(hasVessel: true, hasPlanPill: true),
        ] {
            #expect(edge.tailLift >= edge.clearance)
        }
    }

    /// The room a pill costs the rows is DERIVED from the lane it draws, so a lane that grows with
    /// the type takes the room under it with it rather than leaving the rows short.
    @Test
    func `the room a pill costs grows with the lane it draws`() {
        let cost = FeedBottomEdge(hasPlanPill: true).clearance - FeedBottomEdge.bare.clearance

        #expect(cost > ArgoPlanPill.laneHeight)
        #expect(cost > ArgoPlanPill.lift)
    }
}
