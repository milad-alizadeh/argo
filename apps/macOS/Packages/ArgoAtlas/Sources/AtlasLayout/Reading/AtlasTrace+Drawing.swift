import CoreGraphics

/// The trace part way through DRAWING ITSELF (#1425). The prototype commits a pin edge by edge and
/// then holds it (`docs/designs/cockpit-atlas.html`, `pinMark`), and the share below is how far
/// through that it has got.
///
/// ONE budget spent across every stroke in order, rather than a share of each: the roof is walked
/// first and the standing corners after it, so the mark reads as a line drawn round the box rather
/// than as five lines growing at once.
package extension AtlasTrace {
    /// The whole trace, in points — what a share of it is a share OF.
    var length: CGFloat {
        strokes.reduce(0) { total, stroke in
            total + zip(stroke, stroke.dropFirst()).reduce(0) { $0 + AtlasTrace.run($1.0, $1.1) }
        }
    }

    /// The strokes as far as `share` of the whole has been drawn, cut mid-segment where the budget
    /// runs out inside one. A stroke the budget never reaches is dropped rather than emitted as a
    /// single point: a lone point is a move with nothing after it, which strokes a dot at the
    /// corner of a box.
    func strokes(drawnTo share: Double) -> [[CGPoint]] {
        guard share < 1 else { return strokes }
        guard share > 0 else { return [] }
        var budget = CGFloat(share) * length
        var drawn: [[CGPoint]] = []
        for stroke in strokes where budget > 0 {
            let part = AtlasTrace.part(of: stroke, within: &budget)
            if part.count > 1 {
                drawn.append(part)
            }
        }
        return drawn
    }

    /// One stroke as far as the budget carries it, spending what it uses.
    private static func part(of stroke: [CGPoint], within budget: inout CGFloat) -> [CGPoint] {
        var part = Array(stroke.prefix(1))
        for (from, to) in zip(stroke, stroke.dropFirst()) where budget > 0 {
            let run = run(from, to)
            let reached = run > 0 ? min(1, budget / run) : 1
            part.append(
                CGPoint(
                    x: from.x + (to.x - from.x) * reached,
                    y: from.y + (to.y - from.y) * reached,
                ),
            )
            budget -= run
        }
        return part
    }

    private static func run(_ from: CGPoint, _ to: CGPoint) -> CGFloat {
        ((to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y)).squareRoot()
    }
}
