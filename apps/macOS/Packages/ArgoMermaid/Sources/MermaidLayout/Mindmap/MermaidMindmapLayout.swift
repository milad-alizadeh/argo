import Foundation

// A mindmap placed: the root on the centre, its branches tidied either side of it, and a connector
// from every node back to the one it hangs from.
//
// The plan is INDEPENDENT of the measure it is asked for. A map is as wide as its own branches and
// no column can change that, so one too wide for the prose it sits in is scrolled rather than
// reflowed — which is what lets the renderer and the lane read one geometry.

extension MermaidMindmap {
    var laid: MermaidPlan {
        let steps = walk
        let boxes = MermaidBranches.of(self).boxes
        return MermaidPlan(
            // The joins first, so a connector runs UNDER the boxes at either end of it.
            figures: joins(steps, in: boxes) + zip(steps, boxes).map(Self.figure),
            captions: zip(labels, boxes).map { MermaidCaption(label: $0, rect: $1) },
            // Answered by `normalised`, which is the only thing that has seen every mark.
            size: .zero,
        ).normalised
    }

    private static func figure(of step: Step, in box: CGRect) -> MermaidFigure {
        MermaidFigure(
            form: .shape(step.node.outline, box),
            role: step.node.isCalledOut ? .emphasis : .node,
        )
    }

    /// One connector per node hanging off another: out of the parent's outward edge, across the
    /// gap, and into the child's inward one.
    ///
    /// An elbow and not a straight run. A diagonal to a box several bands away crosses whatever
    /// stands between them, and a mindmap's own branches are the thing most likely to be there.
    private func joins(_ steps: [Step], in boxes: [CGRect]) -> [MermaidFigure] {
        zip(steps, boxes).compactMap { step, box in
            guard let parent = step.parent else { return nil }
            return MermaidFigure(form: .path(Self.elbow(from: boxes[parent], to: box)), role: .edge)
        }
    }

    private static func elbow(from parent: CGRect, to child: CGRect) -> [CGPoint] {
        let isTrailing = child.midX > parent.midX
        let start = CGPoint(x: isTrailing ? parent.maxX : parent.minX, y: parent.midY)
        let end = CGPoint(x: isTrailing ? child.minX : child.maxX, y: child.midY)
        let turn = (start.x + end.x) / 2
        return [start, CGPoint(x: turn, y: start.y), CGPoint(x: turn, y: end.y), end]
    }
}
