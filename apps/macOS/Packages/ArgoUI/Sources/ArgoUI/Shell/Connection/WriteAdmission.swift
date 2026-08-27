import ArgoEngine

/// Whether a provider-port write control may be pressed, and what to say when it may not.
public enum WriteAdmission: Equatable, Sendable {
    /// Attempt it. Healthy, and `stale` too — a failing read does not prove a write will fail.
    case admitted
    /// No usable token for this Account. Disable, and point at reconnecting **this** identity: a
    /// provider has N grants on a machine, and "reconnect GitHub" names none of them.
    case refused(AccountRecord)
    /// No Binding to write through: the port is unbound, or its Binding has come undone — the
    /// Account removed, or the provider no longer serving the port. Neither is a control to grey
    /// out, because neither is a control; the Connect panel's row is where both are repaired.
    case noBinding
}

public extension ConnectionHealthReading {
    /// What one port admits, for a caller deciding whether its write control is live.
    ///
    /// The reading is per Binding, so the ports answer independently: a dead Work Item grant leaves
    /// the code host writable.
    func writes(through port: AccountPort) -> WriteAdmission {
        guard let connection = connections.first(where: { $0.port == port }) else {
            return .noBinding
        }
        return connection.health.admitsWrites ? .admitted : .refused(connection.account)
    }
}
