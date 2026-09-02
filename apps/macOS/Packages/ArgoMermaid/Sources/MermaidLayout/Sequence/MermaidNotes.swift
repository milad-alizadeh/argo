import Foundation

/// The notes a sequence diagram sets beside its lifelines, each sized to what it says.
///
/// A note's BOX takes the container role and only its words take the note's, which is not a
/// contradiction: the ground is what stops the lifeline behind it running through the text, and the
/// quieter ink on the words is what still reads it as an aside.
@MainActor
enum MermaidNotes {
    static func drawn(_ stage: MermaidStage)
        -> (figures: [MermaidFigure], captions: [MermaidCaption]) {
        var figures: [MermaidFigure] = []
        var captions: [MermaidCaption] = []
        for (at, event) in stage.diagram.events.enumerated() {
            guard case let .note(note) = event else { continue }
            let rect = rect(of: note, at: at, in: stage)
            if let rect {
                figures.append(MermaidFigure(form: .shape(.rect, rect)))
            }
            // A note with no room still takes its caption. Dropping one would slide every later
            // label one place along, and `MermaidLayout` places its subviews by that position.
            captions.append(MermaidCaption(
                label: MermaidLabel(
                    text: note.text, face: MermaidMeasure.edgeFace, role: .note,
                ),
                rect: rect?.insetBy(dx: MermaidMeasure.nodeInsetX, dy: 0) ?? .zero,
            ))
        }
        return (figures, captions)
    }

    /// Where a note stands. `nil` for one naming a participant the diagram never met, which the
    /// reader does not produce.
    private static func rect(
        of note: MermaidSequence.Note,
        at index: Int,
        in stage: MermaidStage,
    )
        -> CGRect? {
        let lines = note.over.compactMap { stage.x(of: $0) }
        guard let first = lines.min(), let last = lines.max() else { return nil }
        let width = MermaidColumns.box(of: note)
        let height = ceil(MermaidMeasure.edgeFace.lineBox) + MermaidMeasure.nodeInsetY * 2
        let x: CGFloat
        var across = width
        switch note.placement {
        case .left:
            x = first - MermaidMeasure.nodeGap - width
        case .right:
            x = first + MermaidMeasure.nodeGap
        case .over:
            // Over two lifelines the box reaches from one to the other, or stays as wide as its
            // own words where they run wider than the pair stands apart.
            across = max(width, last - first)
            x = (first + last - across) / 2
        }
        return CGRect(
            x: x, y: stage.rows.top(at: index), width: across, height: height,
        )
    }
}
