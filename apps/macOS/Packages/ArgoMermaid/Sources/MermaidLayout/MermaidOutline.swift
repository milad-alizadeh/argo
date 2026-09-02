import Foundation

/// The closed outlines a plan can be made of — mermaid's node shapes, and the enclosure a
/// `subgraph` draws.
///
/// Its own vocabulary rather than the reader's `MermaidFlowchart.Shape`, because a plan knows
/// nothing about what read it (#859). The two happen to line up today; the moment a second diagram
/// type wants an ellipse, only one of them grows a case.
package enum MermaidOutline: Equatable, Hashable, Sendable {
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
    /// A starburst: mermaid's `))bang((`.
    case bang
    /// A run of bumps around a soft body: mermaid's `)cloud(`.
    case cloud
    /// The frame a `subgraph` is drawn as, at its own softer corner.
    case enclosure
    /// A disc filled in its own ink: a state machine's start, and the centre of its end.
    case dot
    /// A bar filled in its own ink: a fork or a join.
    case bar

    /// Whether the outline is FILLED in its own line ink rather than stroked in it.
    ///
    /// A mark this small is a solid or it is a smudge — the same reason a connector's head is
    /// filled. Its own property and not a role, because what a dot MEANS is still a node.
    package var isSolid: Bool {
        self == .dot || self == .bar
    }
}
