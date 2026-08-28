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
    /// The corner a node's box is drawn with, and the line its edge and its connectors are drawn
    /// at.
    static let nodeRadius: CGFloat = ArgoRadius.control
    static let stroke: CGFloat = ArgoStroke.border

    /// How far a connector's head runs back from its tip, and how wide it stands there. Measures
    /// and not steps: this is the size of a mark that reads as a smear much under six points, and
    /// it must stay well inside `rankGap`.
    static let arrowLength: CGFloat = 7
    static let arrowWidth: CGFloat = 6

    /// The narrowest a node's box is drawn, so a one-letter node is still a box rather than a chip.
    static let nodeMinWidth: CGFloat = 44
}
