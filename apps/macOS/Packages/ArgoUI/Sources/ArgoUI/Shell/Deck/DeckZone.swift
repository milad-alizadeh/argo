/// The zones of the Sessions deck that are laid out but not yet built, each filled by its own
/// ticket. A zone leaves this list the moment something real draws it — the feed did, and a case
/// for it here would be a placeholder for a surface that exists.
enum DeckZone: CaseIterable, Identifiable {
    case tabs
    case rail
    case minimap

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .tabs: "Deck tabs"
        case .rail: "Agents rail"
        case .minimap: "Minimap lane"
        }
    }

    /// Whether the zone is narrower than its own name, so its mark has to be turned to fit.
    /// A property of the zone rather than an argument, so no call site can get it wrong.
    var marksVertically: Bool {
        switch self {
        case .minimap: true
        case .tabs, .rail: false
        }
    }
}
