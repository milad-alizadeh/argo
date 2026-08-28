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
