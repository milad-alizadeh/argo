import Foundation

/// An enclosure drawn: a frame around exactly the boxes of its members, with its title in the band
/// along the top of that frame.
///
/// The frame is the union of the member boxes and nothing else, so a group really does contain its
/// members and nothing it does not own. Standing clear of the node next door is `MermaidRanks`'
/// job — every gap in a graph carrying one is widened by the same inset drawn here.
struct MermaidEnclosure: Equatable, Sendable {
    let figure: MermaidFigure
    /// The rect the frame's own title is measured into.
    let title: CGRect
}

extension MermaidEnclosure {
    /// The frame around these members. `nil` where they were all unplaced, which is a group no
    /// reader produces.
    static func around(_ members: [String], in boxes: [String: CGRect]) -> Self? {
        let placed = members.compactMap { boxes[$0] }
        guard let first = placed.first else { return nil }
        let band = ceil(MermaidMeasure.groupFace.lineBox)
        let frame = placed.dropFirst().reduce(first) { $0.union($1) }
            .insetBy(dx: -MermaidMeasure.groupInset, dy: -MermaidMeasure.groupInset)
        let whole = CGRect(
            x: frame.minX, y: frame.minY - band,
            width: frame.width, height: frame.height + band,
        )
        return MermaidEnclosure(
            figure: MermaidFigure(form: .shape(.enclosure, whole), role: .note),
            title: CGRect(
                x: whole.minX + MermaidMeasure.groupInset, y: whole.minY,
                width: max(0, whole.width - MermaidMeasure.groupInset * 2), height: band,
            ),
        )
    }
}
