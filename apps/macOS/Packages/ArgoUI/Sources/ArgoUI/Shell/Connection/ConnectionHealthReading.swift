import ArgoEngine

/// One of the active Project's ports, the identity it reads through, and how that connection is
/// doing.
///
/// The Account travels with the port because the account level is what the chip has to be able to
/// say. "GitHub needs reconnecting" was a complete sentence while a provider had one grant on a
/// machine; with two it names neither the thing that broke nor the thing to press.
public struct PortConnection: Equatable, Sendable, Identifiable {
    public let port: AccountPort
    public let account: AccountRecord
    public let health: BindingHealth

    public init(port: AccountPort, account: AccountRecord, health: BindingHealth) {
        self.port = port
        self.account = account
        self.health = health
    }

    public var id: AccountPort {
        port
    }
}

/// What the chip rolls up: the active Project's bound ports and nothing else.
///
/// Per-project truth, surfaced only for the Project the window is on. A background Project whose
/// provider died stays silent — you learn on switch, which is also the first moment you could act
/// on it, and the strip's one dot channel says "your agent is waiting on you" and never this.
///
/// Unbound ports are simply absent. A Project with no Work Item provider is a fully-onboarded
/// state, not a connection that is down.
public struct ConnectionHealthReading: Equatable, Sendable {
    public let connections: [PortConnection]

    /// Nothing to say — a window with no Project, no Bindings, or nothing failing. The chip's
    /// resting state, and the one it holds for almost all of a session.
    public static let quiet = ConnectionHealthReading(connections: [])

    public init(connections: [PortConnection]) {
        self.connections = connections
    }
}
