/// The zones of the Sessions deck that are laid out but not yet built, each filled by its own
/// ticket. A zone leaves this list the moment something real draws it — the feed did, and a case
/// for it here would be a placeholder for a surface that exists.
enum DeckZone: CaseIterable, Identifiable {
    case tabs
    case rail

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .tabs: "Deck tabs"
        case .rail: "Agents rail"
        }
    }
}
