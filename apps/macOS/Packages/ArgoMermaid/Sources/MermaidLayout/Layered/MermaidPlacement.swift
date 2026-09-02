import Foundation

/// Every node's box: which rank it stands in, where across that rank, and how big it is.
///
/// The sizes arrive already measured on the graph — with the same prose metrics the paragraphs
/// around the diagram are measured with, so a diagram sets at the feed's rhythm rather than
/// floating at a scale of its own. Where they then go is `MermaidGrain`'s answer, which is what
/// makes the four directions one pass rather than four.
///
/// An enclosure gets contiguity and wider gaps, not a lane of its own. A lane per group keeps every
/// frame clear of every stranger, and it also pushes a plain chain off its own line the moment one
/// node of it is grouped — which is the far commoner diagram. So a group whose members span ranks a
/// stranger also stands in can still be framed around that stranger; that is a compound layout, and
/// a follow-up behind this same seam (#861).
struct MermaidPlacement {
    let boxes: [String: CGRect]
    let grain: MermaidGrain
    /// The room the boxes alone take, before any enclosure is drawn around them.
    let size: CGSize
}

extension MermaidPlacement {
    /// The rows laid out along their grain, each rank centred on the widest one.
    static func of(_ graph: MermaidGraph, rows: [[String]]) -> Self {
        let ranks = MermaidRanks(graph: graph)
        let alongs = rows.map(ranks.along)
        let acrosses = rows.map(ranks.across)
        let grain = MermaidGrain(
            direction: graph.direction,
            depth: alongs.reduce(0, +) + ranks.rankStep * CGFloat(max(0, rows.count - 1)),
        )
        let widest = acrosses.max() ?? 0
        var boxes: [String: CGRect] = [:]
        var along: CGFloat = 0
        for (at, row) in rows.enumerated() {
            var across = (widest - acrosses[at]) / 2
            for name in row {
                let size = ranks.size(of: name)
                boxes[name] = grain.rect(
                    // Centred in its rank's own depth, so a tall box and a short one on the same
                    // rank hang off one line rather than off the rank's ceiling.
                    along: along + (alongs[at] - ranks.flat.along(of: size)) / 2,
                    across: across,
                    size: size,
                )
                across += ranks.flat.across(of: size) + ranks.nodeStep
            }
            along += alongs[at] + ranks.rankStep
        }
        return MermaidPlacement(
            boxes: boxes,
            grain: grain,
            size: grain.isVertical
                ? CGSize(width: widest, height: grain.depth)
                : CGSize(width: grain.depth, height: widest),
        )
    }
}
