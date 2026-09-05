import ArgoDesign
import SwiftUI

/// The ground under a row: what it is painted in, and the shape that paint takes.
///
/// One value and not two, because the two are one decision. A selected row wears the brand hue
/// (#875) in the shape the design draws it in, and an unselected row wears nothing at all —
/// `transparent` in the same shape draws no pixel, so there is a single drawing here rather than
/// a branch between one.
///
/// The geometry is the design's, read off `cockpit-roster-row.html` rather than off a render: the
/// rail insets its rows by `--base` on both sides and the row's own corner is `--r-control`. At
/// the rail's 320pt that is a ground 304pt wide, which is what `roster-row/running.png` measures
/// (#1443). The platform's own sidebar capsule sits inside it — 300pt wide, inset 10.0pt, ramp
/// near 7pt — so the design is the wider of the two by 4pt and nothing here needs a rung off the
/// spacing ladder to say it.
///
/// A shape and not the bare `Color` this used to be: a colour fills the whole cell, so there was
/// nowhere for a radius or an inset to come from, and the ground drew square and full-bleed
/// against a design that draws it rounded and inset.
public struct SelectedRowGround: Shape, Equatable {
    /// Nothing at all under an unselected row — the list's own surface, which in a rail is the
    /// system material D3 reserves for it and in the backlog is the deck.
    public let paint: ArgoColor

    public init(isSelected: Bool, palette: ArgoPalette) {
        self.paint = isSelected ? palette.interaction.selectionGround : .transparent
    }

    /// Inset on both sides and flush top to bottom: the rows meet, and a vertical inset would
    /// open a gap neither the design nor the platform's capsule has.
    public func path(in rect: CGRect) -> Path {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .path(in: rect.insetBy(dx: ArgoSpacing.base, dy: 0))
    }
}
