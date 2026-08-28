import Foundation

/// Every node's box: which rank it stands in, where along that rank, and how big it is.
///
/// Sizes are measured with the same prose metrics the paragraphs around the diagram are measured
/// with, so a diagram sets at the feed's rhythm rather than floating at a scale of its own. Where
/// they then go is `MermaidAxis`'s answer, which is what makes the four directions one pass rather
/// than four.
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

/// How far a rank reaches on each axis, and the gaps it keeps. A value rather than four parameters
/// threaded through the pass that uses them.
@MainActor
private struct MermaidRanks {
    let sizes: [String: CGSize]
    /// An axis with no depth, used only to ask which way a size is measured — the real one is not
    /// known until every rank has been measured with this.
    let flat: MermaidAxis
    /// The extra room every gap gives an enclosure to close around its members without shutting
    /// over the node next door. Zero for a chart with no `subgraph` in it.
    let inset: CGFloat

    init(chart: MermaidFlowchart) {
        self.sizes = chart.nodes.reduce(into: [String: CGSize]()) {
            $0[$1.name] = MermaidPlacement.box(of: $1)
        }
        self.flat = MermaidAxis(direction: chart.direction, depth: 0)
        self.inset = chart.groups.isEmpty ? 0 : MermaidMeasure.groupInset * 2
    }

    var rankStep: CGFloat {
        MermaidMeasure.rankGap + inset
    }

    var nodeStep: CGFloat {
        MermaidMeasure.nodeGap + inset
    }

    func size(of name: String) -> CGSize {
        sizes[name] ?? .zero
    }

    /// How deep into the ranks one rank reaches: its tallest box.
    func along(of row: [String]) -> CGFloat {
        row.map { flat.along(of: size(of: $0)) }.max() ?? 0
    }

    /// How far one rank reaches across: its boxes and the gaps between them.
    func across(of row: [String]) -> CGFloat {
        row.map { flat.across(of: size(of: $0)) }.reduce(0, +)
            + nodeStep * CGFloat(max(0, row.count - 1))
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
        let words = CGSize(
            width: max(
                MermaidMeasure.nodeMinWidth,
                ceil(ProseMetrics.width(of: node.label)) + MermaidMeasure.nodeInsetX * 2,
            ),
            height: ceil(ProseFace.body.lineBox) + MermaidMeasure.nodeInsetY * 2,
        )
        switch node.shape {
        case .circle:
            let side = max(words.width, words.height)
            return CGSize(width: side, height: side)
        case .diamond:
            return CGSize(
                width: ceil(words.width * MermaidMeasure.diamondScale),
                height: ceil(words.height * MermaidMeasure.diamondScale),
            )
        case .hexagon, .flag:
            return CGSize(width: words.width + MermaidMeasure.flagPoint * 2, height: words.height)
        case .rect, .rounded, .stadium, .subroutine, .cylinder:
            return words
        }
    }
}
