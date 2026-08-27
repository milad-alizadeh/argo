import ArgoEngine

public extension ConnectScopes.State {
    /// The provider's answer as the picker draws it.
    init(_ catalogue: ScopeCatalogue) {
        switch catalogue {
        case let .listed(scopes, truncated):
            self = .listed(scopes, truncated: truncated)
        case .unauthorized:
            self = .unauthorized
        case let .unreadable(why):
            self = .unreadable(why)
        }
    }
}
