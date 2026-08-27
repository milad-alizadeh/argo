/// One of the backlog's four views (`cockpit-work-room.md` — the sidebar holds views, not
/// tickets). A view's name is WRITTEN rather than inherited from a tracker, which is the whole
/// reason these fit a 280pt rail where ticket titles did not.
enum WorkView: String, Sendable, CaseIterable, Identifiable {
    case allOpen
    case unblocked
    case inProgress
    case blocked

    var id: Self {
        self
    }

    var name: String {
        switch self {
        case .allOpen: "All open"
        case .unblocked: "Unblocked"
        case .inProgress: "In progress"
        case .blocked: "Blocked"
        }
    }

    var symbol: String {
        switch self {
        case .allOpen: ArgoSymbol.allOpenView
        case .unblocked: ArgoSymbol.unblockedView
        case .inProgress: ArgoSymbol.inProgressView
        case .blocked: ArgoSymbol.blockedView
        }
    }
}
