import ArgoEngine

/// Whether a provider-port write control may be pressed, and what to say when it may not.
///
/// Three answers rather than a Bool, because the two ways a write cannot happen are different
/// repairs: an Account whose grant is gone is one press of `Reconnect`, and a port nothing is bound
/// to is a Binding to make in the Connect panel. A Bool would send both to the same greyed control
/// with nothing to do about it.
public enum WriteAdmission: Equatable, Sendable {
    /// Attempt it. Healthy, and `stale` too — a failing read does not prove a write will fail.
    case admitted
    /// No usable token for this Account, so the write provably cannot land. Disable, and point at
    /// reconnecting **this** identity: a provider has N grants on a machine, and "reconnect GitHub"
    /// names none of them.
    case refused(AccountRecord)
    /// Nothing is bound to the port. A fully-onboarded state, not a failure — there is no provider
    /// to write through, so there is no control to grey out either.
    case unbound
}

public extension ConnectionHealthReading {
    /// What one port admits, for a caller deciding whether its write control is live.
    ///
    /// The reading is per Binding, so the ports answer independently: a dead Work Item grant leaves
    /// the code host writable, which is the whole reason health is not keyed by Project.
    func writes(through port: AccountPort) -> WriteAdmission {
        guard let connection = connections.first(where: { $0.port == port }) else {
            return .unbound
        }
        return connection.health.admitsWrites ? .admitted : .refused(connection.account)
    }
}
