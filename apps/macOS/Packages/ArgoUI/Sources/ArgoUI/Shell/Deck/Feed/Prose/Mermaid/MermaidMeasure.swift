import SwiftUI

/// What a drawn diagram is measured at — `ArgoFeedRow`'s sibling for `MermaidPlan`, so no layout
/// and no view spells a number. Every GAP names a step of `ArgoSpacing`; a bare number is a content
/// MEASURE and carries its reason here.
enum MermaidMeasure {
    /// The breathing room inside a node's box, around its label.
    static let nodeInsetX: CGFloat = ArgoSpacing.comfortable
    static let nodeInsetY: CGFloat = ArgoSpacing.snug
    /// Between one rank of nodes and the next — the lane a connector and its head are drawn in.
    static let rankGap: CGFloat = ArgoSpacing.section
    /// Between two nodes of the same rank.
    static let nodeGap: CGFloat = ArgoSpacing.loose
    /// Between a `subgraph`'s enclosure and the nodes inside it, and the room that enclosure asks
    /// of the gaps around it so it does not close over the node next door.
    static let groupInset: CGFloat = ArgoSpacing.comfortable
    /// How far out of the ranks a back edge runs to get around them.
    static let backLane: CGFloat = ArgoSpacing.comfortable
    /// The corner a node's box is drawn with, and the line its edge and its connectors are drawn
    /// at.
    static let nodeRadius: CGFloat = ArgoRadius.control
    static let groupRadius: CGFloat = ArgoRadius.popover
    static let stroke: CGFloat = ArgoStroke.border
    /// A thick link, which has to read as heavier than a plain one across a whole diagram.
    static let thickStroke: CGFloat = ArgoStroke.indicator
    /// The dash a dotted link is drawn with: on for `dash`, off for the same again, so it reads as
    /// dotted at the one width every other line here is drawn at.
    static let dash: CGFloat = ArgoStroke.dash

    /// How far a connector's head runs back from its tip, and how wide it stands there. Measures
    /// and not steps: this is the size of a mark that reads as a smear much under six points, and
    /// it must stay well inside `rankGap`.
    static let arrowLength: CGFloat = 7
    static let arrowWidth: CGFloat = 6

    /// The narrowest a node's box is drawn, so a one-letter node is still a box rather than a chip.
    static let nodeMinWidth: CGFloat = 44

    /// What a flag's point and a cylinder's lid take off the box they are drawn in. Measures: both
    /// are the size of a mark rather than a step of the rhythm, and both must stay a fraction of
    /// the narrowest box above.
    static let flagPoint: CGFloat = 10
    static let lidDepth: CGFloat = 5

    /// How much bigger a diamond stands than the words in it. A ratio and not a step: a label
    /// inscribed in a rhombus clears the sloping sides only where the box around it is half again
    /// as big, because the shape is at its full width on ONE line and narrows from there.
    static let diamondScale: CGFloat = 1.5

    /// How far an edge's word stands off the line it belongs to. Clear of the stroke and still
    /// obviously attached to it.
    static let wordGap: CGFloat = ArgoSpacing.tight

    /// The face an edge's own word is set in, and the face a `subgraph`'s title takes. Quieter than
    /// the prose the nodes are set in, because both are said ABOUT the diagram rather than in it.
    static let edgeFace = ProseFace(rung: .footnote)
    static let groupFace = ProseFace(rung: .footnote, isBold: true)
}
