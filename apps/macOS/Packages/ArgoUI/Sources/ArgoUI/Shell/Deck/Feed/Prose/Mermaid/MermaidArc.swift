import SwiftUI

/// A wedge of the circle inscribed in a box, from `start` to `end`.
///
/// Its own vocabulary rather than any reader's, like `MermaidOutline` beside it: a pie's slice
/// today, and whatever else is cut from a circle after it (#859).
///
/// Angles are TURNS, clockwise from twelve o'clock, so a whole circle is `0` to `1`. A turn is the
/// unit a chart is actually written in — a share IS a turn — which is what keeps π out of every
/// layout that draws one.
struct MermaidArc: Equatable, Sendable {
    let start: Double
    let end: Double

    /// How far the wedge runs, in turns. Never backwards and never past a whole circle, so
    /// everything below is written once rather than guarding again.
    var sweep: Double {
        min(max(end - start, 0), 1)
    }
}

extension MermaidArc {
    /// The wedge as one closed path, in the box the layout measured it into.
    func path(in rect: CGRect) -> Path {
        let circle = Self.circle(in: rect)
        var path = Path()
        path.addArc(
            center: Self.centre(of: circle),
            radius: circle.width / 2,
            startAngle: Self.angle(start),
            endAngle: Self.angle(end),
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

    /// The box the wedge really occupies, which is smaller than the circle it is cut from unless
    /// it IS the circle.
    ///
    /// Exact rather than the box it was measured into, because this is what `MermaidPlan` sizes a
    /// plan from and what the overview lane draws. A LONE arc — one segment, a sweep — would
    /// otherwise claim a whole square for a quarter-circle mark and fail the height contract
    /// looking like a layout bug; and a pie would map to one copy of its own circle per slice
    /// rather than to a silhouette.
    func bounds(in rect: CGRect) -> CGRect {
        let circle = Self.circle(in: rect)
        guard sweep < 1 else { return circle }
        let rim = ([start, end] + quarters).map { Self.point($0, on: circle) }
        return .around([Self.centre(of: circle)] + rim)
    }

    /// The quarter turns this sweep passes through. They are the four places the rim reaches
    /// furthest along an axis, and the only points of a wedge's box that its own two edges do not
    /// already set.
    private var quarters: [Double] {
        (0 ..< 4)
            .map { Double($0) / 4 }
            .map { $0 + (start - $0).rounded(.up) }
            .filter { $0 <= end }
    }

    /// The circle the wedge is cut from: the biggest one the box holds, centred in it — so a
    /// circle stays a circle whatever rect it was handed.
    private static func circle(in rect: CGRect) -> CGRect {
        let radius = min(rect.width, rect.height) / 2
        return CGRect(
            x: rect.midX - radius,
            y: rect.midY - radius,
            width: radius * 2,
            height: radius * 2,
        )
    }

    private static func centre(of circle: CGRect) -> CGPoint {
        CGPoint(x: circle.midX, y: circle.midY)
    }

    private static func point(_ turn: Double, on circle: CGRect) -> CGPoint {
        let radians = angle(turn).radians
        let radius = circle.width / 2
        return CGPoint(
            x: circle.midX + radius * cos(radians),
            y: circle.midY + radius * sin(radians),
        )
    }

    /// A turn as the angle SwiftUI draws it at, and the one place the two conventions are
    /// reconciled — its own zero is three o'clock and its y runs down, so a clockwise chart
    /// starting at twelve is the same sweep a quarter turn back.
    private static func angle(_ turn: Double) -> Angle {
        .degrees(turn * 360 - 90)
    }
}
