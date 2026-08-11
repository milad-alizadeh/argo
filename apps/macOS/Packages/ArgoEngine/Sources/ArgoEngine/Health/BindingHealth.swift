import Foundation

/// The two words a connection is rendered with, healthy being the absence of both.
///
/// `needsReconnect` is the account level's one escalation past the roll-up: it is the only failure
/// Argo can prove will not fix itself, because there is no usable token, and so the only one that
/// earns a button. Everything else waits, which is why the three causes live under `stale` rather
/// than beside it.
public enum ConnectionState: Equatable, Sendable {
    /// Reads are landing. Renders nothing at all — a permanently-lit healthy indicator trains the
    /// eye to skip the spot the warning appears in.
    case healthy
    /// Reads are failing and what was already fetched still stands. Old, not wrong.
    case stale(ConnectionCause)
    case needsReconnect
}

/// One Binding's connection, as of a moment.
///
/// Staleness is a property of **this**, never of an individual fact. A ticket list fetched
/// yesterday is still accurately DERIVED and is rendered at full fidelity while this reads
/// `stale` — the connection is what went old, and per-fact staleness badges are the thing that
/// separation exists to prevent.
public struct BindingHealth: Equatable, Sendable {
    /// What is failing, and at which level. `nil` is healthy.
    public let fault: ConnectionFault?
    /// When a read through this Binding last landed, and `nil` when none ever has. Kept across a
    /// failure rather than cleared by it: it is what the chip's age is measured from, and clearing
    /// it would make a connection that has been down for an hour indistinguishable from one that
    /// was never up.
    public let lastSuccess: Date?

    public static let healthy = BindingHealth(fault: nil, lastSuccess: nil)

    public init(fault: ConnectionFault?, lastSuccess: Date?) {
        self.fault = fault
        self.lastSuccess = lastSuccess
    }

    public var state: ConnectionState {
        switch fault {
        case .none: .healthy
        case .grantRefused: .needsReconnect
        case let .read(cause): .stale(cause)
        }
    }

    /// Which level is failing, and `nil` while nothing is. The answer to "does one reconnect fix
    /// this, or one rebind" — carried apart from `state` because the state vocabulary has no room
    /// for it.
    public var level: ConnectionLevel? {
        fault?.level
    }

    /// How long since a read last landed. `nil` when none ever has, which is a different fact from
    /// zero and is rendered as one.
    public func age(asOf now: Date) -> TimeInterval? {
        lastSuccess.map { max(now.timeIntervalSince($0), 0) }
    }

    /// Whether a provider write may be attempted. `stale` keeps them live — a failing read does not
    /// prove a write will fail, and greying a control out on that guess asserts a fact Argo does
    /// not
    /// have. `needsReconnect` disables them, because there it does: no token, no write.
    public var allowsWrites: Bool {
        state != .needsReconnect
    }
}
