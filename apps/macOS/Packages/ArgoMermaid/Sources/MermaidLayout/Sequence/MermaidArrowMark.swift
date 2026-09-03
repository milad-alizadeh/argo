import Foundation

/// What stands at the far end of an arrow, drawn.
///
/// Only the filled head is the plan's own `arrowhead`. An open head and a cross are STROKED marks —
/// two of the three say what they say by being hollow, and filling either of them would make it the
/// third.
enum MermaidArrowMark {
    static func figures(
        of head: MermaidSequence.Head,
        tip: CGPoint,
        from: CGPoint,
    )
        -> [MermaidFigure] {
        switch head {
        case .none:
            []
        case .filled:
            [MermaidFigure(form: .arrowhead(tip: tip, from: from), role: .edge)]
        case .open:
            [MermaidFigure(form: .path(barbs(tip: tip, from: from)), role: .edge)]
        case .cross:
            cross(at: tip, from: from)
        }
    }

    /// The two barbs of an open head, as one polyline running through the tip — mermaid's `-)`,
    /// which says a message that was sent and not waited on.
    private static func barbs(tip: CGPoint, from: CGPoint) -> [CGPoint] {
        let step = MermaidStep(tip: tip, from: from)
        return [step.back(along: 1, across: 1), tip, step.back(along: 1, across: -1)]
    }

    /// A cross ON the tip: mermaid's `-x`, a message that never arrived. Drawn square to the line
    /// so it reads as a cross whichever way the arrow was running.
    private static func cross(at tip: CGPoint, from: CGPoint) -> [MermaidFigure] {
        let step = MermaidStep(tip: tip, from: from)
        return [
            [step.back(along: 1, across: 1), step.back(along: -1, across: -1)],
            [step.back(along: 1, across: -1), step.back(along: -1, across: 1)],
        ].map { MermaidFigure(form: .path($0), role: .edge) }
    }
}

/// One step back from an arrow's tip, along the line it came in on and square to it. The mark's own
/// frame, so a head is drawn the way the arrow runs at any angle.
private struct MermaidStep {
    private let tip: CGPoint
    private let along: CGPoint
    private let across: CGPoint

    init(tip: CGPoint, from: CGPoint) {
        let run = CGPoint(x: tip.x - from.x, y: tip.y - from.y)
        let length = max(sqrt(run.x * run.x + run.y * run.y), MermaidMeasure.stroke)
        self.tip = tip
        self.along = CGPoint(x: run.x / length, y: run.y / length)
        self.across = CGPoint(x: -run.y / length, y: run.x / length)
    }

    /// The point `along` lengths back from the tip and `across` half-widths off the line.
    func back(along steps: CGFloat, across offsets: CGFloat) -> CGPoint {
        let length = MermaidMeasure.arrowLength * steps
        let width = MermaidMeasure.arrowWidth / 2 * offsets
        return CGPoint(
            x: tip.x - along.x * length + across.x * width,
            y: tip.y - along.y * length + across.y * width,
        )
    }
}
