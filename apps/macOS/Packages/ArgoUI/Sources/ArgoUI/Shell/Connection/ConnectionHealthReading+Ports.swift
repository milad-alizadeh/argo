import ArgoEngine

/// Building the chip's reading out of the two sources that know about a port: what the registries
/// SHOW, and what a read RECORDED.
///
/// In the package rather than on the coordinator, for the reason ADR-0022 gives: it is a derivation
/// over values, and a derivation in the app target is one no test can reach.
public extension ConnectionHealthReading {
    /// Everything one reading is folded from. A value rather than three parameters because it is
    /// one subject — the machine's Accounts, what its reads have reported, and which Project the
    /// window is on.
    struct Sources: Sendable {
        public let registry: AccountRegistry
        public let ledger: ConnectionHealthLedger
        /// The active Project, and `nil` when there is none. Health is per-project truth, so
        /// without one there is nothing any recorded read belongs to.
        public let projectID: String?

        public init(
            registry: AccountRegistry,
            ledger: ConnectionHealthLedger,
            projectID: String?,
        ) {
            self.registry = registry
            self.ledger = ledger
            self.projectID = projectID
        }
    }

    /// The reading over ports already resolved. Unbound ports are absent rather than healthy: a
    /// Project with no Work Item provider is a fully-onboarded state, not a connection.
    static func over(
        _ ports: [ConnectPort],
        from sources: Sources,
    ) async
        -> ConnectionHealthReading {
        var connections: [PortConnection] = []
        for port in ports {
            guard let connection = await connection(port, from: sources) else { continue }
            connections.append(connection)
        }
        return ConnectionHealthReading(connections: connections)
    }

    /// What the ledger has recorded about one port, for `PortConnection` to fold with what the
    /// registries show.
    ///
    /// A row whose Account is gone, or whose provider cannot fill the port, produces nothing here:
    /// it is a decision to remake, and the panel's own row says so with a fix. Two voices for one
    /// repair is the second failure language this refuses to coin.
    private static func connection(
        _ port: ConnectPort,
        from sources: Sources,
    ) async
        -> PortConnection? {
        guard let projectID = sources.projectID, let accountID = port.accountID,
              let scope = port.scope,
              let account = sources.registry.account(id: accountID) else { return nil }
        let binding = ProjectBinding(port: port.port, accountID: accountID, scope: scope)
        return await PortConnection(
            port: port,
            account: account,
            observed: sources.ledger.health(of: binding, in: projectID),
        )
    }
}
