import SwiftUI

/// A plan drawn: every figure in the ink its ROLE resolves to, and nothing else. Written once, for
/// every diagram type there will ever be.
///
/// The captions are not here. They are real `Text` views placed over this by `MermaidLayout`, so a
/// node's label stays selectable and stays sharp at Retina instead of being glyphs painted into a
/// bitmap.
struct MermaidDrawing {
    let plan: MermaidPlan
    let ink: MermaidInk

    func draw(in context: inout GraphicsContext) {
        for figure in plan.figures {
            draw(figure, in: &context)
        }
    }

    private func draw(_ figure: MermaidFigure, in context: inout GraphicsContext) {
        let path = Self.path(of: figure.form)
        if let ground = ink.ground(of: figure.role) {
            context.fill(path, with: .color(ground.color))
        }
        let line = ink.line(of: figure.role).color
        switch figure.form {
        // A head is a solid mark and not an outline: at this size a stroked triangle reads as a
        // smudge.
        case .arrowhead:
            context.fill(path, with: .color(line))
        case .rect, .roundedRect, .diamond, .ellipse, .path:
            context.stroke(path, with: .color(line), lineWidth: MermaidMeasure.stroke)
        }
    }

    private static func path(of form: MermaidFigure.Form) -> Path {
        switch form {
        case let .rect(rect): Path(rect)
        case let .roundedRect(rect): rounded(rect)
        case let .diamond(rect): diamond(in: rect)
        case let .ellipse(rect): Path(ellipseIn: rect)
        case let .path(points): line(through: points)
        case let .arrowhead(tip, from): arrowhead(tip: tip, from: from)
        }
    }

    private static func rounded(_ rect: CGRect) -> Path {
        Path(roundedRect: rect, cornerRadius: MermaidMeasure.nodeRadius)
    }

    private static func diamond(in rect: CGRect) -> Path {
        line(through: [
            CGPoint(x: rect.midX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.midY),
            CGPoint(x: rect.midX, y: rect.maxY),
            CGPoint(x: rect.minX, y: rect.midY),
        ], closed: true)
    }

    /// A triangle on the tip, as wide at its back as the measure sheet says and standing on the
    /// line it came in on, so a head reads the way the connector runs whatever angle that is.
    private static func arrowhead(tip: CGPoint, from: CGPoint) -> Path {
        let run = CGPoint(x: tip.x - from.x, y: tip.y - from.y)
        let length = max(sqrt(run.x * run.x + run.y * run.y), MermaidMeasure.stroke)
        let along = CGPoint(x: run.x / length, y: run.y / length)
        let across = CGPoint(
            x: -along.y * MermaidMeasure.arrowWidth / 2,
            y: along.x * MermaidMeasure.arrowWidth / 2,
        )
        let back = CGPoint(
            x: tip.x - along.x * MermaidMeasure.arrowLength,
            y: tip.y - along.y * MermaidMeasure.arrowLength,
        )
        return line(through: [
            tip,
            CGPoint(x: back.x + across.x, y: back.y + across.y),
            CGPoint(x: back.x - across.x, y: back.y - across.y),
        ], closed: true)
    }

    private static func line(through points: [CGPoint], closed: Bool = false) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for point in points.dropFirst() {
            path.addLine(to: point)
        }
        if closed {
            path.closeSubpath()
        }
        return path
    }
}
