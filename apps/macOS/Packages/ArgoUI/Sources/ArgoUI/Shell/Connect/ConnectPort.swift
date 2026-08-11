import ArgoEngine

/// One port as the panel is told about it: which Account fills it, through which scope, and
/// whether that choice still reads.
///
/// A state of its own rather than `BindingResolution`, because a resolution carries the grant and
/// a token has no business crossing into a view. The app converts one into the other, and nothing
/// on this side of the seam can hold a token even by accident.
public enum ConnectPortState: Equatable, Sendable {
    case unbound
    case bound(accountID: String, scope: String)
    /// Recorded, and no longer readable through. Kept apart from `unbound` for the reason the
    /// engine keeps them apart: a choice that has come undone is re-bindable, and an absence is a
    /// different claim about the same row.
    case broken(accountID: String, scope: String, fault: BindingFault)
}

/// A port and what fills it — the pair the panel draws one row from.
public struct ConnectPort: Equatable, Sendable, Identifiable {
    public let port: AccountPort
    public let state: ConnectPortState

    public init(port: AccountPort, state: ConnectPortState) {
        self.port = port
        self.state = state
    }

    public var id: AccountPort {
        port
    }

    /// The Account this row names, whichever way it names it. Bound and broken both point at one,
    /// and every reader of this type wants the same answer from the two.
    public var accountID: String? {
        switch state {
        case .unbound: nil
        case let .bound(accountID, _), let .broken(accountID, _, _): accountID
        }
    }

    public var scope: String? {
        switch state {
        case .unbound: nil
        case let .bound(_, scope), let .broken(_, scope, _): scope
        }
    }
}
