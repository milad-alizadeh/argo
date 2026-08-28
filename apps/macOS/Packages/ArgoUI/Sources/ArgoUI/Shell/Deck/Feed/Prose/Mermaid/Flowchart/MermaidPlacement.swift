import Foundation

/// Every node's box: which rank it stands in, where across that rank, and how big it is.
///
/// Sizes are measured with the same prose metrics the paragraphs around the diagram are measured
/// with, so a diagram sets at the feed's rhythm rather than floating at a scale of its own. Where
/// they then go is `MermaidAxis`'s answer, which is what makes the four directions one pass rather
/// than four.
///
/// A `subgraph` gets contiguity and wider gaps, not a lane of its own. A lane per group keeps every
/// enclosure clear of every stranger, and it also pushes a plain chain off its own line the moment
/// one node of it is grouped — which is the far commoner diagram. So a group whose members span
/// ranks a stranger also stands in can still be framed around that stranger; that is a compound
/// layout, and a follow-up behind this same seam (#861).
@MainActor
struct MermaidPlacement {
    let boxes: [String: CGRect]
    let axis: MermaidAxis
    /// The room the boxes alone take, before any enclosure is drawn around them.
    let size: CGSize
}

extension MermaidPlacement {
    /// The rows laid out along their axis, each rank centred on the widest one.
    static func of(_ chart: MermaidFlowchart, rows: [[String]]) -> Self {
        let ranks = MermaidRanks(chart: chart)
        let alongs = rows.map(ranks.along)
        let acrosses = rows.map(ranks.across)
        let axis = MermaidAxis(
            direction: chart.direction,
            depth: alongs.reduce(0, +) + ranks.rankStep * CGFloat(max(0, rows.count - 1)),
        )
        let widest = acrosses.max() ?? 0
        var boxes: [String: CGRect] = [:]
        var along: CGFloat = 0
        for (at, row) in rows.enumerated() {
            var across = (widest - acrosses[at]) / 2
            for name in row {
                let size = ranks.size(of: name)
                boxes[name] = axis.rect(
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
            axis: axis,
            size: axis.isVertical
                ? CGSize(width: widest, height: axis.depth)
                : CGSize(width: axis.depth, height: widest),
        )
    }
}

extension MermaidPlacement {
    /// One node's box: its label at the feed's own prose metrics, plus the room around it. Whole
    /// points, so the height the lane reports is the height SwiftUI draws rather than a fraction
    /// either of them might round differently.
    ///
    /// A circle is squared off and a pointed shape widened, because a label inscribed in either
    /// only fits the box it was measured into if that box is bigger than the words.
    static func box(of node: MermaidFlowchart.Node) -> CGSize {
        let words = MermaidWords.box(of: node.label)
        switch node.shape {
        case .circle:
            return MermaidWords.squared(words)
        case .diamond:
            return CGSize(
                width: ceil(words.width * MermaidMeasure.diamondScale),
                height: ceil(words.height * MermaidMeasure.diamondScale),
            )
        case .hexagon, .flag:
            return MermaidWords.pointed(words)
        case .rect, .rounded, .stadium, .subroutine, .cylinder:
            return words
        }
    }
}
