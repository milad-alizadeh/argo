import Foundation

/// Where each band of a diagram starts across the ranks, and how wide it stands.
///
/// One lane per `subgraph` and a last one for the nodes in none, running the whole depth of the
/// diagram. A group's frame is the union of its members' boxes, so a group whose lane is its own is
/// a group whose frame cannot close over a node it does not own.
struct MermaidLanes: Equatable, Sendable {
    /// One per band, in band order.
    let offsets: [CGFloat]
    let widths: [CGFloat]
    /// How far the bands reach altogether — the diagram's own measure across.
    let total: CGFloat

    /// Where a run of boxes that wide starts, centred in its band.
    func start(of band: Int, holding across: CGFloat) -> CGFloat {
        guard band < offsets.count else { return 0 }
        return offsets[band] + (widths[band] - across) / 2
    }
}
