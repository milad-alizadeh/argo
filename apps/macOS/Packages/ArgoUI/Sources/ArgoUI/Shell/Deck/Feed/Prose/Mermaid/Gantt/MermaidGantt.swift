import Foundation

/// A Gantt chart as its source wrote it: what it is called, how its ticks are spelled, and the
/// sections of dated tasks under them.
///
/// The dates are already `Date`s and the two input grammars are already gone — a `dateFormat` is
/// how the SOURCE spelled a date and nothing downstream has a use for it, so the reader spends it
/// and keeps what it read.
struct MermaidGantt: Equatable, Sendable {
    var title = ""
    /// How a tick is labelled, as a `DateFormatter` pattern — see `MermaidGanttFormat`.
    var axisPattern = MermaidGanttFormat.defaultAxis
    /// The days the chart says no work happens on. Already spent on the tasks' own dates — they
    /// are the real ones — and kept because a bar is DRAWN broken around each of them.
    var excludes = MermaidGanttExcludes()
    var sections: [Section] = []

    struct Section: Equatable, Sendable {
        var name: String
        var tasks: [Task] = []
    }

    struct Task: Equatable, Sendable {
        let name: String
        /// The handle the source gave it, empty where it gave none — what an `after` naming it
        /// was resolved against.
        let id: String
        /// What the source said about it besides its dates — see `MermaidGanttState`.
        let states: Set<MermaidGanttState>
        /// Both ends are the REAL ones: an `after` has already been followed and a length has
        /// already been counted in days the chart's `excludes` leaves it (#904).
        let start: Date
        /// Never before `start` — the reader refuses a task that ends before it begins.
        let end: Date
    }

    /// The span the tasks actually cover, which is the whole of what the axis is drawn across.
    /// `nil` for a chart with no task in it, which is a chart this reader never returns.
    var span: ClosedRange<Date>? {
        let tasks = sections.flatMap(\.tasks)
        guard let first = tasks.first else { return nil }
        let start = tasks.reduce(first.start) { Swift.min($0, $1.start) }
        let end = tasks.reduce(first.end) { Swift.max($0, $1.end) }
        return start ... Swift.max(start, end)
    }

    /// Every line the chart writes down its gutter, in order: a section's heading, then each of
    /// its tasks.
    ///
    /// ONE list, read by `labels` and by the layout alike. A heading and a task row placed from
    /// two separate walks would be one edit away from the captions and the labels disagreeing,
    /// which is the pairing `MermaidLayout` rests on.
    var rows: [Row] {
        sections.enumerated().flatMap { at, section in
            // A section named nothing writes no heading, so an unnamed run of tasks starts at the
            // axis rather than under a blank line.
            (section.name.isEmpty ? [] : [Row.heading(section.name)])
                + section.tasks.map { Row.task($0, series: at) }
        }
    }

    enum Row: Equatable, Sendable {
        case heading(String)
        /// A task, and which section it belongs to — the index its bar takes its hue from.
        case task(Task, series: Int)
    }

    /// The chart's own name, at the loudest face a diagram sets — or nothing, where it has none.
    var titleLabel: MermaidLabel? {
        title.isEmpty ? nil : MermaidLabel(text: title, face: MermaidMeasure.titleFace, role: .note)
    }
}
