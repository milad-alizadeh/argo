import MermaidLayout
import SwiftUI

/// A plan drawn: every figure in the ink its ROLE resolves to and at the weight its LINE asks for,
/// and nothing else. Written once, for every diagram type there will ever be.
///
/// The captions are not here. They are real `Text` views placed over this by
/// `MermaidCaptionLayout`, so a
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
        let line = ink.line(of: figure.role).color
        switch figure.form {
        // A solid outline is FILLED in the very ink the others are stroked in, which is what makes
        // a dot a dot and a bar a bar rather than a ring and a hairline box.
        case let .shape(outline, rect) where outline.isSolid:
            context.fill(outline.ground(in: rect), with: .color(line))
        case let .shape(outline, rect):
            if let ground = ink.ground(of: figure.role, at: figure.weight) {
                context.fill(outline.ground(in: rect), with: .color(ground.color))
            }
            context.stroke(outline.path(in: rect), with: .color(line), style: figure.style)
        // Filled in its series' own hue and bounded by the same edge every figure takes, which is
        // what keeps two adjacent wedges two wedges.
        case let .arc(arc, rect):
            let wedge = arc.path(in: rect)
            if let ground = ink.ground(of: figure.role, at: figure.weight) {
                context.fill(wedge, with: .color(ground.color))
            }
            context.stroke(wedge, with: .color(line), style: figure.style)
        case let .path(points):
            context.stroke(MermaidPath.through(points), with: .color(line), style: figure.style)
        case let .polygon(points):
            context.fill(MermaidPath.through(points, closed: true), with: .color(line))
        // A head is a solid mark and not an outline: at this size a stroked triangle reads as a
        // smudge.
        case let .arrowhead(tip, from):
            context.fill(Self.arrowhead(tip: tip, from: from), with: .color(line))
        }
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
        return MermaidPath.through([
            tip,
            CGPoint(x: back.x + across.x, y: back.y + across.y),
            CGPoint(x: back.x - across.x, y: back.y - across.y),
        ], closed: true)
    }
}

extension MermaidFigure {
    /// The pen this figure is stroked with. The three link kinds have to be told apart at a glance,
    /// so they differ in weight AND in pattern rather than in colour — a diagram is one ink.
    var style: StrokeStyle {
        switch line {
        case .solid:
            StrokeStyle(lineWidth: MermaidMeasure.stroke)
        case .thick:
            StrokeStyle(lineWidth: MermaidMeasure.thickStroke)
        case .dotted:
            StrokeStyle(
                lineWidth: MermaidMeasure.stroke,
                dash: [MermaidMeasure.dash, MermaidMeasure.dash],
            )
        }
    }
}
