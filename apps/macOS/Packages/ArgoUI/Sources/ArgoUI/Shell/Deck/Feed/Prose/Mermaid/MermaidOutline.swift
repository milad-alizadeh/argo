import Foundation

/// The closed outlines a plan can be made of — mermaid's node shapes, and the enclosure a
/// `subgraph` draws.
///
/// Its own vocabulary rather than the reader's `MermaidFlowchart.Shape`, because a plan knows
/// nothing about what read it (#859). The two happen to line up today; the moment a second diagram
/// type wants an ellipse, only one of them grows a case.
enum MermaidOutline: Equatable, Hashable, Sendable {
    case rect
    case rounded
    case diamond
    /// A circle when the box is square, which is the only box a layout gives it.
    case ellipse
    /// Both ends fully rounded: mermaid's stadium.
    case capsule
    /// A rect with a bar down each end.
    case subroutine
    /// Six sides, the two ends cut back to a point.
    case hexagon
    /// Five sides, one end cut to a point: mermaid's asymmetric flag.
    case flag
    /// A drum standing on its end — a rect with an elliptical lid.
    case cylinder
    /// The frame a `subgraph` is drawn as, at its own softer corner.
    case enclosure
}
