import Foundation

/// One side of a mindmap, laid out tidily: every subtree given a BAND down the page as tall as it
/// needs, and every depth a column across it as wide as its widest node.
///
/// The bands are the whole argument for non-overlap. Siblings take disjoint bands and a subtree
/// never leaves its own, so two nodes at one depth cannot meet; the columns are laid end to end
/// with a gap between, so two at different depths cannot either.
struct MermaidTidy {
    let sizes: [CGSize]
    let children: [[Int]]
    /// One box per node, in the walk's own order.
    private(set) var boxes: [CGRect]
    /// How tall each node's whole subtree stands.
    private var bands: [CGFloat]
    /// How far each column of the side being laid stands out from the root's centre.
    private var reaches: [CGFloat] = []
    private var side: Side = .trailing

    init(sizes: [CGSize], children: [[Int]]) {
        self.sizes = sizes
        self.children = children
        self.boxes = [CGRect](repeating: .zero, count: sizes.count)
        self.bands = [CGFloat](repeating: 0, count: sizes.count)
    }

    /// Which way out of the centre a branch grows.
    enum Side {
        case leading, trailing
    }
}

extension MermaidTidy {
    /// One side's branches placed, stacked in the order the source wrote them and centred on the
    /// root's own line.
    mutating func lay(_ branches: [Int], towards side: Side) {
        guard !branches.isEmpty else { return }
        self.side = side
        for branch in branches {
            measure(branch)
        }
        reaches = Self.reaches(fromHalf: sizes[0].width / 2, over: widths(under: branches))
        var top = -Self.stacked(branches.map { bands[$0] }) / 2
        for branch in branches {
            place(branch, inColumn: 0, top: top)
            top += bands[branch] + MermaidMeasure.nodeGap
        }
    }

    /// The root, on the centre both sides were laid around.
    mutating func layRoot() {
        boxes[0] = CGRect(
            origin: CGPoint(x: -sizes[0].width / 2, y: -sizes[0].height / 2), size: sizes[0],
        )
    }

    /// How tall a node's whole subtree stands: its children's bands end to end, or its own box
    /// where that is taller.
    private mutating func measure(_ at: Int) {
        for child in children[at] {
            measure(child)
        }
        bands[at] = max(sizes[at].height, Self.stacked(children[at].map { bands[$0] }))
    }

    /// One node's box, its subtree centred in the band it was given.
    private mutating func place(_ at: Int, inColumn column: Int, top: CGFloat) {
        boxes[at] = CGRect(
            origin: CGPoint(
                x: x(of: sizes[at], inColumn: column),
                y: top + (bands[at] - sizes[at].height) / 2,
            ),
            size: sizes[at],
        )
        var next = top + (bands[at] - Self.stacked(children[at].map { bands[$0] })) / 2
        for child in children[at] {
            place(child, inColumn: column + 1, top: next)
            next += bands[child] + MermaidMeasure.nodeGap
        }
    }

    /// Where a box of that size sits across the map: hard against the near side of its column, so
    /// a branch reads outward from the centre rather than floating in the middle of its lane.
    private func x(of size: CGSize, inColumn column: Int) -> CGFloat {
        // In range by construction: a column exists for every depth under the branches laid.
        let reach = reaches[column]
        return side == .trailing ? reach : -reach - size.width
    }

    /// How far out each column stands, the first clear of the root's own box.
    private static func reaches(fromHalf half: CGFloat, over widths: [CGFloat]) -> [CGFloat] {
        var reaches: [CGFloat] = []
        var reach = half + MermaidMeasure.rankGap
        for width in widths {
            reaches.append(reach)
            reach += width + MermaidMeasure.rankGap
        }
        return reaches
    }

    /// The widest node of each depth under these branches, outward.
    private func widths(under branches: [Int]) -> [CGFloat] {
        var widths: [CGFloat] = []
        var level = branches
        while !level.isEmpty {
            widths.append(level.map { sizes[$0].width }.max() ?? 0)
            level = level.flatMap { children[$0] }
        }
        return widths
    }

    /// Those bands end to end, with a gap between each pair.
    private static func stacked(_ bands: [CGFloat]) -> CGFloat {
        guard !bands.isEmpty else { return 0 }
        return bands.reduce(0, +) + MermaidMeasure.nodeGap * CGFloat(bands.count - 1)
    }
}
