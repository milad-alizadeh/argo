import Foundation

/// Which way a flowchart's ranks grow, and how a rank's own line runs across them.
///
/// The direction changes the AXIS the layout works on, never the algorithm. Everything downstream
/// speaks in `along` — how deep into the ranks — and `across` — where in its own rank — and this is
/// the one type that turns that pair into a point on the screen.
struct MermaidAxis: Equatable, Sendable {
    let direction: MermaidFlowchart.Direction
    /// How far the ranks reach altogether, which is what a reversed direction counts back from.
    let depth: CGFloat

    /// `TD` and `BT` grow down the page; `LR` and `RL` grow across it.
    var isVertical: Bool {
        direction == .down || direction == .up
    }

    /// `BT` and `RL` run the other way, so rank zero stands at the far end.
    var isReversed: Bool {
        direction == .up || direction == .left
    }
}

extension MermaidAxis {
    /// How much of the rank axis a box of this size takes.
    func along(of size: CGSize) -> CGFloat {
        isVertical ? size.height : size.width
    }

    /// How much of its own rank's line a box of this size takes.
    func across(of size: CGSize) -> CGFloat {
        isVertical ? size.width : size.height
    }

    /// A box, from where it starts on each axis and how big it is.
    func rect(along: CGFloat, across: CGFloat, size: CGSize) -> CGRect {
        let along = isReversed ? depth - along - self.along(of: size) : along
        return CGRect(
            origin: isVertical
                ? CGPoint(x: across, y: along)
                : CGPoint(x: along, y: across),
            size: size,
        )
    }

    /// The middle of the face a connector LEAVES a box by — the one facing the next rank.
    func exit(of box: CGRect) -> CGPoint {
        face(of: box, ahead: !isReversed)
    }

    /// The middle of the face a connector ENTERS a box by.
    func entry(of box: CGRect) -> CGPoint {
        face(of: box, ahead: isReversed)
    }

    /// The middle of one of the two faces that look up and down the rank axis.
    func face(of box: CGRect, ahead: Bool) -> CGPoint {
        isVertical
            ? CGPoint(x: box.midX, y: ahead ? box.maxY : box.minY)
            : CGPoint(x: ahead ? box.maxX : box.minX, y: box.midY)
    }

    /// The middle of the face on the leading side of a box ACROSS its rank — where a back edge
    /// leaves and re-enters, because the faces it would otherwise use are already spoken for.
    func flank(of box: CGRect) -> CGPoint {
        isVertical ? CGPoint(x: box.minX, y: box.midY) : CGPoint(x: box.midX, y: box.minY)
    }

    /// A point from the pair every layout step speaks in.
    func point(along: CGFloat, across: CGFloat) -> CGPoint {
        isVertical ? CGPoint(x: across, y: along) : CGPoint(x: along, y: across)
    }

    /// Where a point stands on the rank axis, whichever axis that is.
    func along(of point: CGPoint) -> CGFloat {
        isVertical ? point.y : point.x
    }

    /// Where a point stands across its rank.
    func across(of point: CGPoint) -> CGFloat {
        isVertical ? point.x : point.y
    }
}
