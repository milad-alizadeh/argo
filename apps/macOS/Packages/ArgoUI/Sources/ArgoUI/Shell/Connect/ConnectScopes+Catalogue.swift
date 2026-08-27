import ArgoEngine

public extension ConnectScopes.State {
    /// The provider's answer as the picker draws it. `unauthorized` is spelled out here rather than
    /// carried through: the panel's reader is a person, and "the grant was refused" is only useful
    /// beside what to do about it.
    init(_ catalogue: ScopeCatalogue) {
        switch catalogue {
        case let .listed(scopes, truncated):
            self = .listed(scopes, truncated: truncated)
        case .unauthorized:
            self = .unreadable("This account's authorization was refused. Connect it again.")
        case let .unreadable(why):
            self = .unreadable(why)
        }
    }
}
