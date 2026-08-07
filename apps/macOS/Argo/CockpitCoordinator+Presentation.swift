import ArgoEngine
import ArgoUI
import Foundation

/// The engine's state as the values the views render. The one place the two vocabularies meet.
@MainActor
extension CockpitCoordinator {
    var presentation: CockpitPresentation {
        CockpitPresentation(
            projects: projects,
            activeProjectID: launch.id,
            sessions: hub.sessions.map(session),
            checkout: checkout,
            connection: connection,
        )
    }

    /// The registered set, and — on a launch pointed at a folder nobody registered — that folder
    /// at the head of it. `--project` and a bare launch both land there, and a strip that drew
    /// only the registry would leave the roster on screen belonging to no mark at all.
    ///
    /// The unregistered mark stays for the window's life, not only while it is active: it is the
    /// only way back to where the process was pointed.
    private var projects: [CockpitPresentation.Project] {
        let registered = registry.projects.map {
            CockpitPresentation.Project(
                id: $0.id,
                name: $0.name,
                location: $0.path,
                isReachable: $0.isReachable,
            )
        }
        guard case let .unregistered(url)? = launchOrigin else { return registered }
        return [CockpitPresentation.Project(
            id: url.path,
            name: HubProject(url: url).name,
            location: url.path,
        )] + registered
    }

    private func session(_ session: HubSession) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: session.id,
            title: session.title,
            model: session.model,
            workspaceLocation: session.cwd,
            branch: session.branch,
            access: .readOnly,
            operationalState: nil,
        )
    }

    private var checkout: CockpitPresentation.Checkout {
        switch hub.checkout {
        case let .branch(branch): .branch(branch)
        case let .detached(shortSHA): .detached(shortSHA: shortSHA)
        case .unavailable: .unavailable
        }
    }

    private var connection: CockpitPresentation.Connection {
        switch hub.connection {
        case .healthy: .healthy
        case .reconnecting: .reconnecting
        case let .failed(message): .failed(message: message)
        }
    }
}
