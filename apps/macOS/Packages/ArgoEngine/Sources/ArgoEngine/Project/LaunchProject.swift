import Foundation

/// Which Project a launch opens into, and whether the registry knows it.
///
/// The two cases exist because pointing the Hub is not registration: `--project` survives as the
/// launch/harness override and a bare launch still has to reach a usable cockpit, but neither adds
/// a Project to the machine's known set — that is a deliberate act.
public enum LaunchProject: Equatable, Sendable {
    case registered(ProjectRecord)
    case unregistered(URL)

    /// The override wins, then the active registered Project, then where the process was started.
    ///
    /// An override naming a folder the registry already knows resolves to that record rather
    /// than to a second, unregistered spelling of it — otherwise the strip would draw the same
    /// repository twice, once selected and once not.
    public static func resolve(
        configuration: LaunchConfiguration,
        registry: ProjectRegistry,
    )
        -> LaunchProject {
        if let overrideURL = configuration.projectOverrideURL {
            let known = registry.projects.first { $0.path == overrideURL.path }
            return known.map(LaunchProject.registered) ?? .unregistered(overrideURL)
        }
        if let active = registry.active {
            return .registered(active)
        }
        return .unregistered(configuration.launchDirectoryURL)
    }

    public var url: URL {
        switch self {
        case let .registered(record): record.url
        case let .unregistered(url): url
        }
    }

    /// A registry id where there is one; otherwise the path, which is the only stable name an
    /// unregistered folder has. Identity for the strip to draw with, not a Project id.
    public var id: String {
        switch self {
        case let .registered(record): record.id
        case let .unregistered(url): url.path
        }
    }

    public var isRegistered: Bool {
        switch self {
        case .registered: true
        case .unregistered: false
        }
    }
}
