import Foundation

/// A titled run of bands along a horizontal axis, each holding columns, each column stacking rows
/// beneath its own heading.
///
/// The one shape a journey and a timeline share, and the reason they are one layout rather than
/// two: a journey's task is a column whose rows are its actors, a timeline's period is a column
/// whose rows are its events, and neither the placing nor the plan can tell which read it.
///
/// What differs between them is stated as ROLES the reader hands over, never as a branch here.
struct MermaidBands: Equatable, Sendable {
    let title: String
    let sections: [Section]

    /// One band. Its `name` is empty where the source opened rows before naming a band, which is
    /// the one case a band draws no strip at all.
    struct Section: Equatable, Sendable {
        let name: String
        let role: MermaidRole
        let columns: [Column]
    }

    struct Column: Equatable, Sendable {
        let heading: String
        /// A rating out of `MermaidJourney.scale`, or `nil` where this diagram rates nothing.
        let score: Int?
        let notes: [Note]
    }

    /// One row stacked under a column's heading: an actor on a task, an event in a period.
    struct Note: Equatable, Sendable {
        let text: String
        let role: MermaidRole
    }

    /// The diagram's own name, at the loudest face a diagram sets — or nothing, where it has none.
    var titleLabel: MermaidLabel? {
        title.isEmpty
            ? nil
            : MermaidLabel(text: title, face: MermaidMeasure.titleFace, role: .note)
    }

    /// One label per caption the plan places, in that order: the title, then each band's own name
    /// followed by its columns, and each column's heading followed by its rows.
    ///
    /// The view builds one `Text` from each of these before SwiftUI has told it a measure, so this
    /// order is a contract between the model and `laid` rather than an incidental.
    var labels: [MermaidLabel] {
        (titleLabel.map { [$0] } ?? []) + sections.flatMap(Self.labels(of:))
    }

    private static func labels(of section: Section) -> [MermaidLabel] {
        (section.name.isEmpty ? [] : [label(of: section)])
            + section.columns.flatMap { [label(heading: $0.heading)] + $0.notes.map(label(of:)) }
    }

    static func label(of section: Section) -> MermaidLabel {
        MermaidLabel(text: section.name, face: MermaidMeasure.groupFace, role: section.role)
    }

    static func label(heading: String) -> MermaidLabel {
        MermaidLabel(text: heading)
    }

    static func label(of note: Note) -> MermaidLabel {
        MermaidLabel(text: note.text, face: MermaidMeasure.edgeFace, role: note.role)
    }
}
