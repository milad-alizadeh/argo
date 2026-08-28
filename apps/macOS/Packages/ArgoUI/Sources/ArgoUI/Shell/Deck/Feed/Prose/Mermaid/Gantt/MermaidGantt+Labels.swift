import Foundation

// The words a Gantt chart sets, in the order its plan places them: the title, then every tick on
// the axis, then every line down the gutter.
//
// The extension is `@MainActor` because the ticks are: which dates the axis is marked at is a
// question about how wide the words on them RUN — see `MermaidGanttAxis` — and nothing measures
// words off the main actor. The rest of the list would not need it on its own.

@MainActor
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
