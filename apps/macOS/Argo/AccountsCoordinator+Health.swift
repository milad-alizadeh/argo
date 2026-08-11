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
/// Nothing here polls. A grant that has expired or gone from the keychain is observable from the
/// registries alone, which is why the chip is right about the account level before any read has
/// been attempted — and the binding level's causes arrive the day the ports read (#260).
extension AccountsCoordinator {
    /// Point the reading at a Project, or at none. Raised on launch and on every switch, because
    /// connection health is per-project truth surfaced for the active Project only: a background
    /// Project whose provider died stays silent, and you learn on switch.
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

    /// One port, with what the resolution proved about its grant filed as it goes.
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
        await file(port.state, of: accountID)
        let binding = ProjectBinding(port: port.port, accountID: accountID, scope: scope)
        return await PortConnection(
            port: port.port,
            account: account,
            health: health.health(of: binding, in: projectID),
        )
    }

    private func file(_ state: ConnectPortState, of accountID: String) async {
        switch state {
        // The grant is on file and unexpired, so nothing needs reconnecting — said out loud rather
        // than left implied, or a record written once would outlive the failure it recorded.
        case .bound:
            await health.reconnected(accountID)
        case let .broken(_, _, fault) where fault.connectionFault == .grantRefused:
            await health.grantRefused(accountID)
        case .unbound, .broken:
            break
        }
    }
}
