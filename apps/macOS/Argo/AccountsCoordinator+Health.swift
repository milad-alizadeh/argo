import ArgoEngine
import ArgoUI
import Foundation

/// How the active Project's ports are reading, as the chip's own value.
///
/// Its own file because it is its own subject: the panel is a surface the user opens, and this is a
/// standing fact about the window whether or not they ever do. The two are built from the same
/// resolution — one pass over the ports answers both, so the panel and the chip can never disagree
/// about which Account a port reads through.
///
/// Two sources meet here, and the split is what keeps each honest:
///
/// - **Derived, per refresh** — a grant that has expired or gone from the keychain is visible in
///   the registries alone, so it is read off the resolution every time and never written down.
///   That is why the chip is right about the account level before anything has polled, and why it
///   goes quiet the moment the grant is obtained again.
/// - **Recorded, in the ledger** — what a read actually reported. Nothing produces these yet: the
///   ports read in #260, and the three cause words arrive with them.
extension AccountsCoordinator {
    /// Point the reading at a Project, or at none. Raised on every change of active Project,
    /// because connection health is per-project truth surfaced for the active Project only: a
    /// background Project whose provider died stays silent, and you learn on switch.
    func point(at project: ProjectRecord?) async {
        self.project = project
        await refresh()
    }

    /// The chip's reading over ports already resolved. Unbound ports are absent rather than
    /// healthy: a Project with no Work Item provider is a fully-onboarded state, not a connection.
    func healthReading(over ports: [ConnectPort]) async -> ConnectionHealthReading {
        let registry = await accounts.load()
        var connections: [PortConnection] = []
        for port in ports {
            guard let connection = await connection(port, in: registry) else { continue }
            connections.append(connection)
        }
        return ConnectionHealthReading(connections: connections)
    }

    /// One port, folded from what the registries show and what the ledger has been told.
    ///
    /// A row whose Account is gone, or whose provider cannot fill the port, produces nothing here:
    /// it is a decision to remake and the panel's own row says so with a fix. Two voices for one
    /// repair is the second failure language this refuses to coin.
    private func connection(
        _ port: ConnectPort,
        in registry: AccountRegistry,
    ) async
        -> PortConnection? {
        guard let projectID = project?.id, let accountID = port.accountID, let scope = port.scope,
              let account = registry.account(id: accountID) else { return nil }
        let binding = ProjectBinding(port: port.port, accountID: accountID, scope: scope)
        let observed = await health.health(of: binding, in: projectID)
        return PortConnection(
            port: port.port,
            account: account,
            // The derived fault wins where there is one. It is account-level, and an account-level
            // failure is the prerequisite of every other: there is no token to read a scope with.
            health: derived(from: port.state).map {
                BindingHealth(fault: $0, lastSuccess: observed.lastSuccess)
            } ?? observed,
        )
    }

    private func derived(from state: ConnectPortState) -> ConnectionFault? {
        guard case let .broken(_, _, fault) = state else { return nil }
        return fault.connectionFault
    }
}
