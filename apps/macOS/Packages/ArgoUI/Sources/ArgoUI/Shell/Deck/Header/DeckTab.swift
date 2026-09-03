/// The panes a Session is read through, on the tab line's leading edge
/// (`cockpit-session-interior-decisions.md` C2.2: `Activity · Delivery`, once Outcomes was cut).
///
/// The set and what is DRAWN of it are two different things. A tab is a promise that pressing it
/// changes what the deck reads, so a tab is drawn once its pane exists: Activity's is the reading
/// the deck has carried since #378, and Delivery's is #269. Naming `delivery` here and leaving it
/// out of `shown` says both — the model is the design's, and the deck is honest about which half
/// of it it can show.
enum DeckTab: CaseIterable, Identifiable, Hashable {
    /// The runtime tree — Agent, Turn, Tool Call, Plan (`CONTEXT.md` L3). The feed.
    case activity
    /// The branch-keyed Delivery (`CONTEXT.md` L4). Not drawn: its surface is #269.
    case delivery

    /// The tabs with a surface behind them, in the order the design reads them. A pane shipping
    /// adds its tab here and nowhere else.
    static let shown: [DeckTab] = [.activity]

    /// Where the reading opens. The deck has one pane, and this is the name of it.
    static let opening = DeckTab.activity

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .activity: "Activity"
        case .delivery: "Delivery"
        }
    }
}
