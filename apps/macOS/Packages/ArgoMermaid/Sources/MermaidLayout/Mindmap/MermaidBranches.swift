import Foundation

/// Every mindmap node's box: which side of the root its branch fell on, how far out its depth puts
/// it, and where down the map its own subtree sits.
///
/// A tidy tree either side of the centre rather than a true polar layout. Both give a map read as a
/// map, and only this one places rectangular labels without them ever meeting: two nodes of the
/// same depth stand in disjoint BANDS down the page, and two of different depths in disjoint
/// columns across it, so non-overlap holds by construction rather than by luck (#867).
@MainActor
struct MermaidBranches {
    /// One box per `MermaidMindmap.walk` step, in that order.
    let boxes: [CGRect]

    static func of(_ map: MermaidMindmap) -> Self {
        let steps = map.walk
        var tidy = MermaidTidy(
            sizes: steps.map { MermaidMindmapBox.size(of: $0.node, atDepth: $0.depth) },
            children: Self.children(of: steps),
        )
        let branches = tidy.children[0]
        // The first half go right and the rest left, so the branches go ROUND the root rather than
        // stacking on one side of it — and an odd one out falls on the side read first.
        let split = (branches.count + 1) / 2
        tidy.lay(Array(branches.prefix(split)), towards: .trailing)
        tidy.lay(Array(branches.dropFirst(split)), towards: .leading)
        tidy.layRoot()
        return MermaidBranches(boxes: tidy.boxes)
    }

    /// Who hangs off whom, by position in the walk. The walk is pre-order, so a parent is always
    /// listed before its children and one pass is enough.
    private static func children(of steps: [MermaidMindmap.Step]) -> [[Int]] {
        var children = [[Int]](repeating: [], count: steps.count)
        for (at, step) in steps.enumerated() {
            if let parent = step.parent {
                children[parent].append(at)
            }
        }
        return children
    }
}
