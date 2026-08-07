/// The zones the Sessions deck is laid out from.
///
/// Held as a catalogue rather than spelled at each call site so the container cannot lay out a
/// zone nothing names, and so every slot's placeholder mark is written once. Each is filled by
/// its own ticket: the header and its tabs by #400, the rail by #401, the feed by #399, the
/// lane by #402, the Dock by #403.
enum DeckZone: CaseIterable {
    case header
    case tabs
    case rail
    case feed
    case minimap
    case dock

    var title: String {
        switch self {
        case .header: "Session header"
        case .tabs: "Deck tabs"
        case .rail: "Agents rail"
        case .feed: "Feed"
        case .minimap: "Minimap lane"
        case .dock: "Dock seam"
        }
    }
}
