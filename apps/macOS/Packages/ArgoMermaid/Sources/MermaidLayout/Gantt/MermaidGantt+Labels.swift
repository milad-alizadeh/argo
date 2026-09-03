import Foundation

// The words a Gantt chart sets, in the order its plan places them: the title, then every tick on
// the axis, then every line down the gutter.
//
// Which dates the axis is marked at is itself a question about how wide the words on them RUN —
// see `MermaidGanttAxis`. That is why this list was the main actor's until ADR-0030 moved every
// prose measurement off it.

extension MermaidGantt {
    var labels: [MermaidLabel] {
        (titleLabel.map { [$0] } ?? [])
            + ticks.map { MermaidLabel(text: $0.text, face: MermaidMeasure.edgeFace, role: .axis) }
            + rows.map(Self.label(of:))
    }

    private static func label(of row: Row) -> MermaidLabel {
        switch row {
        case let .heading(name):
            MermaidLabel(text: name, face: MermaidMeasure.groupFace, role: .note)
        case let .task(task, _):
            MermaidLabel(text: task.name, face: MermaidMeasure.edgeFace)
        }
    }
}
