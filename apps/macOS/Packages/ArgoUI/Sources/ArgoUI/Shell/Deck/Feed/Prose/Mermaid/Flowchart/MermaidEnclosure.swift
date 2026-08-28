import Foundation

/// A `subgraph` drawn: a frame around exactly the boxes of its members, with its title in the band
/// along the top of that frame.
///
/// The frame is the union of the member boxes and nothing else, so a group really does contain its
/// members and nothing it does not own. Standing clear of the node next door is `MermaidRanks`'
/// job — every gap in a chart carrying a `subgraph` is widened by the same inset drawn here.
@MainActor
enum MermaidEnclosure {
    /// The frame and the rect its title is measured into. `nil` for a group whose members were all
    /// unplaced, which is a group the reader does not produce.
    static func drawn(
        _ group: MermaidFlowchart.Group,
        in boxes: [String: CGRect],
    )
        -> (figure: MermaidFigure, title: CGRect)? {
        let members = group.members.compactMap { boxes[$0] }
        guard let first = members.first else { return nil }
        let band = ceil(MermaidMeasure.groupFace.lineBox)
        let frame = members.dropFirst().reduce(first) { $0.union($1) }
            .insetBy(dx: -MermaidMeasure.groupInset, dy: -MermaidMeasure.groupInset)
        let whole = CGRect(
            x: frame.minX, y: frame.minY - band,
            width: frame.width, height: frame.height + band,
        )
        return (
            MermaidFigure(form: .shape(.enclosure, whole), role: .note),
            CGRect(
                x: whole.minX + MermaidMeasure.groupInset, y: whole.minY,
                width: max(0, whole.width - MermaidMeasure.groupInset * 2), height: band,
            ),
        )
    }
}
