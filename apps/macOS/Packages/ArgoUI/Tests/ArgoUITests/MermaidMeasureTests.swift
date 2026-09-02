@testable import ArgoUI
@testable import MermaidLayout
import Testing

/// What `MermaidMeasure` claims about a rendered diagram — every member read against another
/// measure of the same drawing, save the feed column the drawing is set in.
@Suite("The measures a rendered diagram is drawn to")
struct MermaidMeasureTests {
    /// A connector's head is drawn in the lane between two ranks, so it has to stand well inside
    /// that lane — a head as long as the gap would touch the box it left.
    @Test
    func `a connector's head stands well inside the gap between two ranks`() {
        #expect(MermaidMeasure.arrowLength > 0)
        #expect(MermaidMeasure.arrowLength < MermaidMeasure.rankGap / 2)
        #expect(MermaidMeasure.arrowWidth < MermaidMeasure.arrowLength * 2)
    }

    /// The floor is what keeps a one-letter node a BOX. It has to clear the room a label is given
    /// on either side of it, or the narrowest node would be narrower than its own padding.
    @Test
    func `the narrowest node is wider than the room its label is given`() {
        #expect(MermaidMeasure.nodeMinWidth > MermaidMeasure.nodeInsetX * 2)
    }

    /// A diagram sets at the feed's rhythm, so its own boxes must not out-measure the column the
    /// prose around them runs to.
    @Test
    func `a node is drawn narrower than the feed's own measure`() {
        #expect(MermaidMeasure.nodeMinWidth < ArgoFeedRow.column - ArgoFeedRow.inset * 2)
    }

    /// A flag's point and a cylinder's lid are cut OUT of the box the label was measured into, so
    /// both have to stay a fraction of the narrowest box there is — a point as wide as the box
    /// leaves a triangle where a node should be.
    @Test
    func `a shape's own cut stays a fraction of the narrowest node`() {
        #expect(MermaidMeasure.flagPoint > 0)
        #expect(MermaidMeasure.flagPoint < MermaidMeasure.nodeMinWidth / 4)
        #expect(MermaidMeasure.lidDepth > 0)
        #expect(MermaidMeasure.lidDepth < MermaidMeasure.flagPoint)
    }

    /// A diamond only clears its own sloping sides where it stands BIGGER than the words, and a
    /// scale under one would make it smaller than them.
    @Test
    func `a diamond is measured bigger than the words inside it`() {
        #expect(MermaidMeasure.diamondScale > 1)
    }

    /// The three link kinds are told apart by weight, so a thick link has to be heavier than a
    /// plain one and a dotted link's gap wide enough to read as a gap at that weight.
    @Test
    func `a loud link is drawn heavier than a plain one`() {
        #expect(MermaidMeasure.thickStroke > MermaidMeasure.stroke)
        #expect(MermaidMeasure.dash > MermaidMeasure.stroke)
    }

    /// A `subgraph`'s frame is a softer corner than the boxes inside it, so the enclosure reads as
    /// a room around them rather than as another node.
    @Test
    func `an enclosure is drawn at a softer corner than the nodes it holds`() {
        #expect(MermaidMeasure.groupRadius > MermaidMeasure.nodeRadius)
    }
}
