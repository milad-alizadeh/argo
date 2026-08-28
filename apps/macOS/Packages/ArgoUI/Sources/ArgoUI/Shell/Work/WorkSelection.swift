/// What the Work room's rail is selecting — one of the four views, or one of the charts under them
/// (#335).
///
/// The rail's tag type, not the room's state: which view is open and which chart is scoped are held
/// apart above the room, so leaving a chart puts the reader back on the rows they left.
enum WorkSelection: Hashable, Sendable {
    case view(WorkView)
    /// A PRD-shaped parent, by its number.
    case chart(Int)

    /// `chart` wins where it is set: it is the row actually highlighted, and the view under it is
    /// only remembered.
    init(view: WorkView, chart: Int?) {
        self = chart.map(WorkSelection.chart) ?? .view(view)
    }
}
