import ArgoDesign
import SwiftUI

/// The ground under a row: what it is painted in, and the shape that paint takes (#1443).
///
/// The geometry is the design's, read off `cockpit-roster-row.html`: the rail insets its rows by
/// `--base` on both sides and the row's corner is `--r-control`, so at `--sidebar-w` the ground is
/// 304pt wide, which is what `roster-row/running.png` measures. The platform's own sidebar capsule
/// sits inside that — 300pt wide, inset 10.0pt, ramp near 7pt.
public struct SelectedRowGround: Shape {
    /// `transparent` under an unselected row, which paints no pixel: the list's own surface stands,
    /// and in a rail that is the system material D3 reserves for it.
    public let paint: ArgoColor

    public init(isSelected: Bool, palette: ArgoPalette) {
        self.paint = isSelected ? palette.interaction.selectionGround : .transparent
    }

    /// What `listRowBackground` takes.
    public var filled: some View {
        fill(paint.color)
    }

    /// Flush top to bottom. The design separates its row grounds by a 1px `margin-bottom`, which
    /// nothing can see while one row at a time is selected, and which a `listRowBackground` inset
    /// vertically would pay for by shrinking the ground on every row.
    public func path(in rect: CGRect) -> Path {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .path(in: rect.insetBy(dx: ArgoSpacing.base, dy: 0))
    }
}
