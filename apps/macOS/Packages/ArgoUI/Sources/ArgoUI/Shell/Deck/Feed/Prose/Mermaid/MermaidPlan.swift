import Foundation

/// A laid-out diagram: every figure and every caption already placed, and the room the whole thing
/// stands in.
///
/// The seam of #859. Flat and resolution-independent — nothing downstream knows which diagram type
/// produced it, which is what lets one view draw them all and one lane map them all.
struct MermaidPlan: Equatable, Sendable {
    let figures: [MermaidFigure]
    /// One per `MermaidDiagram.labels`, in that order: the view builds its `Text` views from the
    /// labels and places them on these.
    let captions: [MermaidCaption]
    let size: CGSize

    static let empty = MermaidPlan(figures: [], captions: [], size: .zero)

    /// The same plan slid into positive coordinates, at the size it really stands.
    ///
    /// Every layout places where it is natural to and normalises afterwards — a flowchart's back
    /// edge, a sequence diagram's self-message and a frame drawn around either all reach outside
    /// the boxes, and a plan whose marks start at a negative is a plan whose edge is drawn off the
    /// block.
    var normalised: MermaidPlan {
        let marks = figures.map(\.form.bounds) + captions.map(\.rect)
        guard let first = marks.first else { return self }
        let bounds = marks.dropFirst().reduce(first) { $0.union($1) }
        let offset = CGPoint(x: -bounds.minX, y: -bounds.minY)
        return MermaidPlan(
            figures: figures.map {
                MermaidFigure(form: $0.form.moved(by: offset), role: $0.role, line: $0.line)
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
enum MermaidRole: Equatable, Sendable, CaseIterable {
    /// A box, a slice, a bar — the thing the diagram is about.
    case node
    /// A connector between two of them, and its head.
    case edge
    /// A mark the diagram itself calls out.
    case emphasis
    /// An aside: a title, a legend, anything said beside the diagram rather than in it.
    case note
}
