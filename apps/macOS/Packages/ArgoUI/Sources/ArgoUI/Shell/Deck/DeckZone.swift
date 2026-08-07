/// The zones the Sessions deck is laid out from, each filled by its own ticket.
enum DeckZone: CaseIterable, Identifiable {
    case header
    case tabs
    case rail
    case feed
    case minimap
    case dock

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .header: "Session header"
        case .tabs: "Deck tabs"
        case .rail: "Agents rail"
        case .feed: "Feed"
        case .minimap: "Minimap lane"
        case .dock: "Dock"
        }
    }

    /// Whether the zone is narrower than its own name, so its mark has to be turned to fit.
    /// A property of the zone rather than an argument, so no call site can get it wrong.
    var marksVertically: Bool {
        switch self {
        case .minimap: true
        case .header, .tabs, .rail, .feed, .dock: false
        }
    }
}
