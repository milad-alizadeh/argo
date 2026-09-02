import Foundation

// Where one closed block's frame is drawn: around exactly the lifelines it touched, from the line
// its keyword was written on to the line under its `end`.
//
// The inset is what makes nesting visible. A frame stands off its own lifelines by how far its
// depth is from the deepest the diagram ever went, so an inner block is drawn INSIDE its outer one
// rather than on top of it — and a diagram that never nests keeps one inset for every frame in it.

extension MermaidFrameWalk {
    func placed(_ open: MermaidOpenFrame, closedAt index: Int) -> MermaidFrame {
        let box = box(of: open, closedAt: index)
        return MermaidFrame(
            opened: open.opened,
            figures: [MermaidFigure(form: .shape(.enclosure, box), role: .note)] + rules(open, box),
            captions: [caption(at: open.opened, in: box, from: box.minY)]
                + open.dividers.map {
                    caption(at: $0, in: box, from: stage.rows.top(at: $0))
                },
        )
    }

    private func box(of open: MermaidOpenFrame, closedAt index: Int) -> CGRect {
        let boxes = stage.columns.boxes
        // A block containing nothing but other blocks reaches nowhere of its own, so it spans the
        // whole diagram rather than collapsing to a sliver.
        let span = open.columns ?? 0 ... max(0, boxes.count - 1)
        let inset = MermaidMeasure.groupInset * CGFloat(deepest - open.depth + 1)
        let left = (boxes.indices.contains(span.lowerBound) ? boxes[span.lowerBound].minX : 0)
            - inset
        let right = (boxes.indices.contains(span.upperBound) ? boxes[span.upperBound].maxX : 0)
            + inset
        let top = stage.rows.top(at: open.opened)
        return CGRect(
            x: left, y: top, width: max(0, right - left),
            height: max(0, stage.rows.bottom(at: index) - top),
        )
    }

    /// The rule an `else`, an `and` or an `option` draws across its frame. Dotted, because it
    /// divides the frame rather than closing anything.
    private func rules(_ open: MermaidOpenFrame, _ box: CGRect) -> [MermaidFigure] {
        open.dividers.map { at in
            let y = stage.rows.top(at: at)
            return MermaidFigure(
                form: .path([CGPoint(x: box.minX, y: y), CGPoint(x: box.maxX, y: y)]),
                role: .note,
                line: .dotted,
            )
        }
    }

    /// A frame's own word, in the band along the top of whatever it labels — the frame itself, or
    /// the run under one of its dividers.
    private func caption(at index: Int, in box: CGRect, from y: CGFloat)
        -> (at: Int, caption: MermaidCaption) {
        let inset = MermaidMeasure.groupInset
        return (index, MermaidCaption(
            label: MermaidLabel(
                text: stage.diagram.frameTitle(at: index) ?? "",
                face: MermaidMeasure.groupFace,
                role: .note,
            ),
            rect: CGRect(
                x: box.minX + inset, y: y,
                width: max(0, box.width - inset * 2),
                height: ceil(MermaidMeasure.groupFace.lineBox),
            ),
            alignment: .leading,
        ))
    }
}
