import ArgoEngine
import ArgoUI
import Foundation

/// The registered set, as the marks the strip draws. Everything the HUB knows is projected by
/// `CockpitPresentation(projects:activeProjectID:hub:)`, which is testable; what is left here is
/// the app's own state, which is the registry and where this launch pointed.
@MainActor
extension CockpitCoordinator {
    var presentation: CockpitPresentation {
        CockpitPresentation(projects: projects, activeProjectID: launch.id, hub: hub)
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
            isRegistered: false,
        )] + registered
    }
}
