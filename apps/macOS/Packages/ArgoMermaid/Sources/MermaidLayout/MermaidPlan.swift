import ArgoDesign
import Foundation

/// A laid-out diagram: every figure and every caption already placed, and the room the whole thing
/// stands in.
///
/// The seam of #859. Flat and resolution-independent — nothing downstream knows which diagram type
/// produced it, which is what lets one view draw them all and one lane map them all.
public struct MermaidPlan: Equatable, Sendable {
    public let figures: [MermaidFigure]
    /// One per `MermaidDiagram.labels`, in that order: the view builds its `Text` views from the
    /// labels and places them on these.
    package let captions: [MermaidCaption]
    public let size: CGSize

    package static let empty = MermaidPlan(figures: [], captions: [], size: .zero)

    /// The same plan slid into positive coordinates, at the size it really stands.
    ///
    /// Every layout places where it is natural to and normalises afterwards — a flowchart's back
    /// edge, a sequence diagram's self-message and a frame drawn around either all reach outside
    /// the boxes, and a plan whose marks start at a negative is a plan whose edge is drawn off the
    /// block.
    package var normalised: MermaidPlan {
        let marks = figures.map(\.form.bounds) + captions.map(\.rect)
        guard let first = marks.first else { return self }
        let bounds = marks.dropFirst().reduce(first) { $0.union($1) }
        let offset = CGPoint(x: -bounds.minX, y: -bounds.minY)
        // Rebuilt FIELD BY FIELD, so a property added to `MermaidFigure` and forgotten here is
        // dropped from every plan silently — nothing else in the type reconstructs one.
        return MermaidPlan(
            figures: figures.map {
                MermaidFigure(
                    form: $0.form.moved(by: offset),
                    role: $0.role,
                    line: $0.line,
                    weight: $0.weight,
                )
            },
            captions: captions.map {
                MermaidCaption(
                    label: $0.label,
                    rect: $0.rect.offsetBy(dx: offset.x, dy: offset.y),
                    alignment: $0.alignment,
                )
            },
            size: CGSize(width: ceil(bounds.width), height: ceil(bounds.height)),
        )
    }
}

/// What a mark of a diagram MEANS. Never a colour: `MermaidInk` resolves a role to a design token,
/// so every diagram type is themed once and no reader spells a colour.
package enum MermaidRole: Equatable, Sendable {
    /// A box, a slice, a bar — the thing the diagram is about.
    case node
    /// A connector between two of them, and its head.
    case edge
    /// A mark the diagram itself calls out.
    case emphasis
    /// The ink of an AXIS: the scale a diagram is measured against rather than a thing it is
    /// about — a plotted field's border, the rules dividing it, a tick, and the words naming
    /// either end of it. Quieter than a node's edge, because an axis is read past rather than at.
    case axis
    /// An aside: a title, a legend, anything said beside the diagram rather than in it.
    case note
    /// The nth entry of a categorical series — a pie's slice, a bar, a Gantt's section.
    ///
    /// INDEXED rather than named, because "the nth thing the source listed" is the whole of what
    /// one means, and it is the only role a reader states a NUMBER for. It wraps past the end of
    /// the palette rather than running out; `ArgoPalette.SeriesRoles` owns that rule.
    ///
    /// A figure's `weight` reads this role and only this one, so the SAME role can be drawn at
    /// three strengths — and a Gantt's plain bar is the middle one while a pie slice is the top.
    /// Deliberate, and forced: a rung above the hue walks into `diff.removed`, so a chart that has
    /// to say "more than ordinary" has nowhere to put it except under the hue (#905). Two diagrams
    /// in one message therefore draw `series(n)` at two strengths; what they never do is draw it
    /// in two HUES, which is the thing the role is for.
    case series(Int)
}
