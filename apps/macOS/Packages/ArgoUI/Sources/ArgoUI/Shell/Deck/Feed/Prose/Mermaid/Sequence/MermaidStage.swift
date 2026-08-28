import Foundation

/// The two axes a sequence diagram's marks are placed against, and the diagram they were measured
/// from: where each participant stands across it, and where each event stands down it.
///
/// One value rather than three arguments threaded through every pass — which is also what keeps
/// each of those passes inside the house's parameter cap.
@MainActor
struct MermaidStage {
    let diagram: MermaidSequence
    let columns: MermaidColumns
    let rows: MermaidSequenceRows

    init(_ diagram: MermaidSequence) {
        let columns = MermaidColumns.of(diagram)
        self.diagram = diagram
        self.columns = columns
        self.rows = MermaidSequenceRows.of(diagram, under: columns.headerHeight)
    }

    /// Where a participant's lifeline runs, or `nil` for a name the diagram never met. The reader
    /// registers every name it reads, so `nil` here is a name the layout invented.
    func x(of name: String) -> CGFloat? {
        diagram.column(of: name).map(columns.centre)
    }

    /// How big a word set beside a mark stands. Nothing at all where it says nothing, so a wordless
    /// message costs no room and still takes its caption.
    func words(of text: String) -> CGSize {
        CGSize(
            width: ceil(ProseMetrics.width(of: text, in: MermaidMeasure.edgeFace)),
            height: MermaidSequenceRows.words(of: text),
        )
    }

    /// Each participant's own figure — an `actor` at its own outline, so the two are told apart
    /// before either is read.
    var heads: [MermaidFigure] {
        zip(diagram.participants, columns.boxes).map { participant, box in
            MermaidFigure(form: .shape(participant.isActor ? .capsule : .rect, box))
        }
    }

    /// One caption per participant, in the order the diagram names them — which is the order
    /// `labels` lists them, and the pairing the view rests on.
    var names: [MermaidCaption] {
        zip(diagram.participants, columns.boxes).map {
            MermaidCaption(label: MermaidLabel(text: $0.label), rect: $1)
        }
    }

    /// The line dropping from each box to the foot of the diagram. Dotted, which is how mermaid
    /// draws a lifeline and what tells it from every message crossing it.
    var lifelines: [MermaidFigure] {
        columns.centres.map { x in
            MermaidFigure(
                form: .path([
                    CGPoint(x: x, y: rows.head),
                    CGPoint(x: x, y: rows.foot),
                ]),
                role: .edge,
                line: .dotted,
            )
        }
    }
}
