import MermaidLayout
import SwiftUI

// The drawn half of `MermaidArc`. Its own file for the reason `MermaidOutline+Path` is one: a
// wedge's geometry decides how big a plan stands and what the overview lane maps, and neither of
// those needs a `Path`.

extension MermaidArc {
    /// The wedge as one closed path, in the box the layout measured it into.
    func path(in rect: CGRect) -> Path {
        let circle = Self.circle(in: rect)
        var path = Path()
        path.addArc(
            center: Self.centre(of: circle),
            radius: circle.width / 2,
            startAngle: .radians(Self.radians(start)),
            endAngle: .radians(Self.radians(end)),
            clockwise: false,
        )
        // A whole circle has already closed on its own start, and a line to the centre would
        // retrace a radius — which draws as a spoke from twelve o'clock.
        if sweep < 1 {
            path.addLine(to: Self.centre(of: circle))
        }
        path.closeSubpath()
        return path
    }
}
