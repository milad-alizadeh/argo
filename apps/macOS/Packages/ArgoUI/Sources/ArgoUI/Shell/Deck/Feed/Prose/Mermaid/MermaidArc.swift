import SwiftUI

/// A wedge of the circle inscribed in a box, from `start` to `end`.
///
/// Its own vocabulary rather than any reader's, like `MermaidOutline` beside it: a pie's slice
/// today, and a donut's ring segment or a gauge's sweep on the same value (#859).
///
/// Angles are TURNS, clockwise from twelve o'clock, so a whole circle is `0` to `1`. A turn is the
/// unit a chart is actually written in — a share IS a turn — which is what keeps π out of every
/// layout that draws one.
struct MermaidArc: Equatable, Sendable {
    let start: Double
    let end: Double
    /// How far in from the rim the wedge reaches, as a share of the radius. `1` closes on the
    /// centre; less leaves a hole, which is the whole difference between a pie and a ring.
    var depth: Double = 1
}

extension MermaidArc {
    /// The wedge as one closed path, in the box the layout measured it into. The radius is the
    /// shorter half of that box, so a circle stays a circle whatever it was handed.
    func path(in rect: CGRect) -> Path {
        let centre = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        let hole = radius * (1 - min(max(depth, 0), 1))
        var path = Path()
        path.addArc(
            center: centre,
            radius: radius,
            startAngle: Self.angle(start),
            endAngle: Self.angle(end),
            clockwise: false,
        )
        if hole <= 0 {
            path.addLine(to: centre)
        } else {
            path.addArc(
                center: centre,
                radius: hole,
                startAngle: Self.angle(end),
                endAngle: Self.angle(start),
                clockwise: true,
            )
        }
        path.closeSubpath()
        return path
    }

    /// A turn as the angle SwiftUI draws it at. Its own zero is three o'clock and its y runs down,
    /// so a clockwise chart starting at twelve is the same sweep a quarter turn back.
    private static func angle(_ turn: Double) -> Angle {
        .degrees(turn * 360 - 90)
    }
}
