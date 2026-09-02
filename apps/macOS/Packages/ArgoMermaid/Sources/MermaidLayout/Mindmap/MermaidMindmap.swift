import Foundation
import ProseText

/// A mindmap as its source wrote it: one root, and the branches nested under it.
///
/// A TREE and not a flat list with a depth on each node, because the nesting IS the diagram. The
/// reader has already resolved the indentation into it, and nothing downstream reads a column
/// again.
struct MermaidMindmap: Equatable, Sendable {
    let root: Node

    struct Node: Equatable, Sendable {
        /// What the node says, its `<br/>` already a newline.
        var text: String
        /// The figure it is drawn as. The plan's own vocabulary rather than a reader's, because
        /// mindmap and flowchart name four of these shapes the same and differ on two.
        var outline: MermaidOutline = .rounded
        /// Whether `:::someClass` was written under it. Argo has no user stylesheet, so what the
        /// class NAMES is dropped and only the fact of it kept — the source called this one out.
        var isCalledOut = false
        var children: [Node] = []
    }

    /// One node of the walk: where it stands in the tree, told flat.
    struct Step: Equatable, Sendable {
        let node: Node
        let depth: Int
        /// Where its parent stands in the same walk. `nil` for the root alone.
        let parent: Int?
    }
}

extension MermaidMindmap {
    /// The nodes in pre-order — the root, then each branch in turn, each branch whole before the
    /// next opens.
    ///
    /// THE order the captions are paired with `labels` in, so it is a contract between the model
    /// and `laid` rather than an incidental.
    var walk: [Step] {
        var steps: [Step] = []
        var pending = [Step(node: root, depth: 0, parent: nil)]
        while let next = pending.popLast() {
            steps.append(next)
            let at = steps.count - 1
            pending += next.node.children.reversed().map {
                Step(node: $0, depth: next.depth + 1, parent: at)
            }
        }
        return steps
    }

    /// One label per caption the plan places, in `walk`'s order.
    ///
    /// The face carries the DEPTH: a branch is set quieter than the root and a twig quieter again,
    /// so a child reads as subordinate to its parent before either of them is read (#867).
    var labels: [MermaidLabel] {
        walk.map {
            MermaidLabel(
                text: $0.node.text,
                face: Self.face(atDepth: $0.depth),
                role: $0.node.isCalledOut ? .emphasis : .node,
            )
        }
    }

    /// What a node of this depth is set in. Three faces and not one per level: past the second the
    /// diagram is already reading as a map, and a fourth size would only be smaller than legible.
    static func face(atDepth depth: Int) -> ProseFace {
        switch depth {
        case 0: ProseFace(isBold: true)
        case 1: ProseFace()
        default: MermaidMeasure.edgeFace
        }
    }
}
