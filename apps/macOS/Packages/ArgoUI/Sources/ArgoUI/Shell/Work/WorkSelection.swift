/// What the Work room's rail is selecting — one of the four views, or one of the charts under them
/// (#335).
///
/// A sum type and not two selections: the rail is one `List` and a reader picks one row from it, so
/// two independent selections would let a chart and a view both look chosen while only one of them
/// decided what the deck drew.
///
/// The charts stood UNTAGGED until now for exactly this reason — a row that looked selectable while
/// the selection was a `WorkView` would have filtered the backlog to something nobody asked for
/// (`WorkSidebar`, #814).
///
/// It is the rail's TAG type rather than the room's state. Which view is open and which chart is
/// scoped are held apart above the room, so a chart does not erase the view a reader was on and
/// leaving one puts them back where they were.
enum WorkSelection: Hashable, Sendable {
    case view(WorkView)
    /// A PRD-shaped parent, by its number. What the deck scopes to, and what a presentation toggle
    /// is keyed by.
    case chart(Int)

    /// The pair the rail's one selection stands for. `chart` wins where it is set: it is the row
    /// actually highlighted, and the view under it is only remembered.
    init(view: WorkView, chart: Int?) {
        self = chart.map(WorkSelection.chart) ?? .view(view)
    }
}
