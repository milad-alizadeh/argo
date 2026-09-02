extension TicketsView {
    /// The ink a view is drawn in, on the sidebar's glyph AND on the row mark that counts into it.
    ///
    /// ONE place, for the reason #939 made the glyph one constant: the rail says "8 blocked" beside
    /// a mark, the rows are the 8 it counted, and a mark that agreed on shape while disagreeing on
    /// colour would be two concepts again. `TicketsBacklogMarkTests` holds each pair in step.
    ///
    /// A view that marks nothing in the list takes no colour. `All open` and `Unblocked` draw
    /// nothing on a row — an unblocked ticket is deliberately unmarked, because the row does not
    /// claim `unblocked` over edges nobody served — so there is no ink to agree with, and a colour
    /// here would mean something the list never says. `Closed` is a third: its rows carry a WORD
    /// rather than a mark counted into a rail, and that word is the caption's own ink (#1075).
    func ink(_ argo: ArgoTheme) -> ArgoColor {
        switch self {
        case .allOpen, .unblocked, .closed: argo.color.text.tertiary
        case .inProgress: argo.color.state.running
        case .blocked: argo.color.state.failure
        }
    }
}
