import ArgoEngine

/// What the engine answers about a port, as the panel's own value.
///
/// The seam where the grant is dropped. `BindingResolution.ready` carries the token the port reads
/// through, and this is the one place that can see it — everything past here is a value that
/// cannot hold one, so no view can render a token even by accident.
public extension ConnectPort {
    /// Every port a Project has, as the panel sees them. In the package rather than on the
    /// coordinator for ADR-0022's reason: it is a derivation over values, and one in the app
    /// target is one no test can reach.
    static func all(
        of projectID: String?,
        through bindings: ProjectBindings,
    ) async
        -> [ConnectPort] {
        guard let projectID else { return [] }
        var resolved: [ConnectPort] = []
        for port in AccountPort.allCases {
            await resolved.append(ConnectPort(
                port: port,
                resolution: bindings.resolve(port: port, for: projectID),
            ))
        }
        return resolved
    }

    init(port: AccountPort, resolution: BindingResolution) {
        switch resolution {
        case .unbound:
            self.init(port: port, state: .unbound)
        case let .ready(resolved):
            self.init(port: port, state: .bound(
                accountID: resolved.binding.accountID,
                scope: resolved.binding.scope,
            ))
        case let .broken(binding, fault):
            self.init(port: port, state: .broken(
                accountID: binding.accountID,
                scope: binding.scope,
                fault: fault,
            ))
        }
    }
}
