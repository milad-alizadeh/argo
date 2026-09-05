import ArgoAtoms
import ArgoDesign
import SwiftUI
import Testing

/// The SHAPE the selected row's ground is drawn in (#1443), where `SelectionGroundTests` holds its
/// colour. The two are held apart because they failed apart: the colour has been right since #875
/// and the geometry was square and full-bleed the whole time, which no reading of a hex could say.
///
/// Every claim below is read off the path the ground actually draws, at the rail's own width, so a
/// radius or an inset that stops arriving fails here rather than in a render nobody ran.
@Suite("Selected row ground geometry")
struct SelectedRowGroundGeometryTests {
    /// The rail's width and a roster row's height. 320 is `--sidebar-w` in the design, which is
    /// what makes the widths below comparable with `roster-row/running.png` at all.
    static let row = CGRect(x: 0, y: 0, width: 320, height: 28)

    static let ground = SelectedRowGround(isSelected: true, palette: .graphite)

    /// The design's own measurement: the rail insets its rows by `--base` on both sides, so at
    /// `--sidebar-w` the ground is 304pt wide — which is what `roster-row/running.png` renders. A
    /// ground that goes back to full bleed reads 320 here.
    @Test
    func `the ground is inset from both of the rail's edges`() {
        let drawn = Self.ground.path(in: Self.row).boundingRect
        #expect(drawn.minX == ArgoSpacing.base)
        #expect(drawn.maxX == Self.row.width - ArgoSpacing.base)
        #expect(drawn.width == 304)
    }

    /// Flush top to bottom. The rows meet in a rail, and a vertical inset would open a gap
    /// neither the design nor the platform's capsule has.
    @Test
    func `the ground is flush with the row's top and bottom`() {
        let drawn = Self.ground.path(in: Self.row).boundingRect
        #expect(drawn.minY == Self.row.minY)
        #expect(drawn.height == Self.row.height)
    }

    /// Rounded, and stated as the thing a square ground fails: the corner of the inset rectangle
    /// is OUTSIDE the shape, while the same edge halfway down the row is inside it. A square
    /// ground contains all three, so this is the claim that was false before #1443.
    @Test
    func `the corners are cut away, and the edge between them is not`() {
        let drawn = Self.ground.path(in: Self.row)
        let edge = ArgoSpacing.base
        #expect(!drawn.contains(CGPoint(x: edge + 0.5, y: Self.row.minY + 0.5)))
        #expect(!drawn.contains(CGPoint(x: edge + 0.5, y: Self.row.maxY - 0.5)))
        #expect(drawn.contains(CGPoint(x: edge + 0.5, y: Self.row.midY)))
    }

    /// Nothing is painted outside the inset, which is the other half of the inset claim: a shape
    /// whose bounding box is right but which bleeds past it fails here.
    @Test
    func `nothing is drawn in the inset itself`() {
        let drawn = Self.ground.path(in: Self.row)
        let outside = CGPoint(x: ArgoSpacing.base - 0.5, y: Self.row.midY)
        #expect(!drawn.contains(outside))
    }

    /// The radius is `control`'s and not a louder rung — the same rung the design's row carries as
    /// `--r-control`. The test is where the ramp has SETTLED rather than at the radius itself: two
    /// rungs in from the inset edge the shape is solid, which a `popover` radius — twice `control`
    /// — would not yet be.
    @Test
    func `the corner ramp settles within two of the control rung`() {
        let drawn = Self.ground.path(in: Self.row)
        let settled = ArgoSpacing.base + ArgoRadius.control * 2
        #expect(drawn.contains(CGPoint(x: settled, y: Self.row.minY + 0.5)))
    }

    /// The colour, still the roster's ground and still opaque — the claim `SelectionGroundTests`
    /// makes about the palette, made here about what the row actually paints.
    @Test
    func `a selected row is painted in the selection ground`() {
        #expect(Self.ground.paint == ArgoPalette.graphite.interaction.selectionGround)
    }

    /// The unselected row draws nothing at all: the same shape, no paint. Stated as a test because
    /// it is the one thing a ground gaining a shape could quietly break — a visible unselected row
    /// is a rail of stripes.
    @Test
    func `an unselected row paints nothing`() {
        let ground = SelectedRowGround(isSelected: false, palette: .graphite)
        #expect(ground.paint == .transparent)
        #expect(ground.paint.opacity == 0)
    }
}
