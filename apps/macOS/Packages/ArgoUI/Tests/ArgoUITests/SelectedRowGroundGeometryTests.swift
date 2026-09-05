import ArgoAtoms
import ArgoDesign
import SwiftUI
import Testing

/// The SHAPE the selected row's ground is drawn in (#1443), where `SelectionGroundTests` holds its
/// colour. Every claim is read off the path the ground actually draws, at the rail's own width.
@Suite("Selected row ground geometry")
struct SelectedRowGroundGeometryTests {
    /// The rail's own width, so the widths below are comparable with `roster-row/running.png`,
    /// which the design renders at `--sidebar-w`.
    static let row = CGRect(x: 0, y: 0, width: ArgoLayout.sidebarIdealWidth, height: 28)

    /// 304pt at the rail's 320: what the design's `--base` inset on both sides comes to, and what
    /// `roster-row/running.png` measures.
    static let designWidth = ArgoLayout.sidebarIdealWidth - ArgoSpacing.base * 2

    static let ground = SelectedRowGround(isSelected: true, palette: .graphite)

    @Test
    func `the ground is inset from both of the rail's edges`() {
        let drawn = Self.ground.path(in: Self.row).boundingRect
        #expect(drawn.minX == ArgoSpacing.base)
        #expect(drawn.maxX == Self.row.width - ArgoSpacing.base)
        #expect(drawn.width == Self.designWidth)
    }

    @Test
    func `the ground is flush with the row's top and bottom`() {
        let drawn = Self.ground.path(in: Self.row).boundingRect
        #expect(drawn.minY == Self.row.minY)
        #expect(drawn.height == Self.row.height)
    }

    /// The corner of the inset rectangle is outside the shape — which a square ground, the one
    /// this replaced, contains.
    @Test
    func `the corners are cut away`() {
        let drawn = Self.ground.path(in: Self.row)
        let edge = ArgoSpacing.base
        #expect(!drawn.contains(CGPoint(x: edge + 0.5, y: Self.row.minY + 0.5)))
        #expect(!drawn.contains(CGPoint(x: edge + 0.5, y: Self.row.maxY - 0.5)))
    }

    /// Between the two corners the shape reaches the inset edge, so the ground is the full 304pt
    /// wherever it is not ramping.
    @Test
    func `the edge between the corners reaches the inset`() {
        let drawn = Self.ground.path(in: Self.row)
        #expect(drawn.contains(CGPoint(x: ArgoSpacing.base + 0.5, y: Self.row.midY)))
    }

    @Test
    func `nothing is drawn in the inset itself`() {
        let drawn = Self.ground.path(in: Self.row)
        let outside = CGPoint(x: ArgoSpacing.base - 0.5, y: Self.row.midY)
        #expect(!drawn.contains(outside))
    }

    /// The radius is `control`'s, the rung the design's row carries as `--r-control`. Read where
    /// the ramp has SETTLED rather than at the radius: two rungs in from the inset edge the shape
    /// is solid, which a `popover` radius — twice `control` — would not yet be.
    @Test
    func `the corner ramp settles within two of the control rung`() {
        let drawn = Self.ground.path(in: Self.row)
        let settled = ArgoSpacing.base + ArgoRadius.control * 2
        #expect(drawn.contains(CGPoint(x: settled, y: Self.row.minY + 0.5)))
    }

    @Test
    func `a selected row is painted in the selection ground`() {
        #expect(Self.ground.paint == ArgoPalette.graphite.interaction.selectionGround)
    }

    @Test
    func `an unselected row paints nothing`() {
        let ground = SelectedRowGround(isSelected: false, palette: .graphite)
        #expect(ground.paint == .transparent)
        #expect(ground.paint.opacity == 0)
    }
}
