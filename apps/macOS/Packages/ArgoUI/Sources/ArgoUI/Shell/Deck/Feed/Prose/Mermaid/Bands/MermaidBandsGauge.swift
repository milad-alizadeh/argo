import Foundation

/// A journey's score, drawn as the rating it is: one step per point of mermaid's fixed scale, lit
/// up to the score.
///
/// The steps are drawn as strokes rather than as rings. Rendered as rings the two states differed
/// only in hue and neither read as filled, which is the one thing a rating mark has to do.
@MainActor
enum MermaidBandsGauge {
    static var width: CGFloat {
        CGFloat(MermaidJourney.scale) * MermaidMeasure.ratingStep
            + CGFloat(MermaidJourney.scale - 1) * MermaidMeasure.ratingGap
    }

    static var height: CGFloat {
        MermaidMeasure.thickStroke
    }

    /// The steps, left to right. A lit step is the diagram calling itself out; an unlit one is the
    /// rest of mermaid's fixed scale, which is read past rather than at. The two differ in weight
    /// as well as in ink, so the rating reads as filled rather than as five marks in two colours.
    static func steps(_ score: Int, at origin: CGPoint) -> [MermaidFigure] {
        (0 ..< MermaidJourney.scale).map { step in
            let isLit = step < score
            let x = origin
                .x + CGFloat(step) * (MermaidMeasure.ratingStep + MermaidMeasure.ratingGap)
            return MermaidFigure(
                form: .path([
                    CGPoint(x: x, y: origin.y + height / 2),
                    CGPoint(x: x + MermaidMeasure.ratingStep, y: origin.y + height / 2),
                ]),
                role: isLit ? .emphasis : .axis,
                line: isLit ? .thick : .solid,
            )
        }
    }
}
