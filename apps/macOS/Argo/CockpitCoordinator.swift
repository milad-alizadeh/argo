import AppKit
import ArgoEngine
import ArgoUI
import Foundation
import Observation

/// What the window is looking at: the registered set, which Project is active, and the Hub pointed
/// at it.
///
/// Registration and the switch live here rather than in `ArgoApp` because both are sequences —
/// choose a folder, write the registry, re-point the Hub — and the scene should hold state, not run
/// them.
@MainActor
@Observable
final class CockpitCoordinator {
    private(set) var registry = ProjectRegistry.empty
    private(set) var launch: LaunchProject

    let hub: Hub
    private let engine: Engine
    private let store: ProjectRegistryStore
    private let configuration: LaunchConfiguration

    init(
        configuration: LaunchConfiguration,
        engine: Engine = Engine(),
        store: ProjectRegistryStore = ProjectRegistryStore(),
    ) {
        self.configuration = configuration
        self.engine = engine
        self.store = store
        self.launch = .unregistered(configuration.projectURL)
        self.hub = Hub(projectURL: configuration.projectURL)
    }

    /// Read the registry, then point the Hub at whatever the launch resolves to. The read comes
    /// first: `--project` overrides the active Project, and the active Project is only knowable
    /// once the file has been read.
    func start() async {
        registry = await store.load()
        await point(at: LaunchProject.resolve(configuration: configuration, registry: registry))
    }

    /// Switching re-points the Hub, which drops the previous Project's tails, roster, checkout and
    /// connection before the new one establishes anything (#418). Nothing of the old one survives.
    func select(projectID: String) async {
        guard let record = registry.projects.first(where: { $0.id == projectID }),
              record.id != launch.id
        else { return }
        registry = await store.activate(id: record.id)
        await point(at: .registered(record))
    }

    /// Registration is the act that creates a Project, so it is a folder the user chooses and
    /// nothing the app infers. The newly registered Project becomes the active one — offering a
    /// folder and staying where you were would read as the registration not having taken.
    func addProject() async {
        guard let folderURL = chooseFolder(prompt: "Register") else { return }
        registry = await store.register(at: folderURL)
        guard let record = registry.projects.first(where: { $0.path == folderURL.path })
            ?? registry.projects.last
        else { return }
        registry = await store.activate(id: record.id)
        await point(at: .registered(record))
    }

    /// Re-point a Project whose folder has moved. Keyed on the id, so this is the same Project it
    /// was — everything linked to it survives the move.
    func locateProject(projectID: String) async {
        guard registry.projects.contains(where: { $0.id == projectID }),
              let folderURL = chooseFolder(prompt: "Locate")
        else { return }
        registry = await store.relocate(id: projectID, to: folderURL)
        guard let record = registry.projects.first(where: { $0.id == projectID }) else { return }
        await point(at: .registered(record))
    }

    func refreshCheckout() async {
        await hub.refreshCheckout(using: engine, at: launch.url)
    }

    /// Retrying re-points at the Project already on screen, rather than re-running the launch: what
    /// failed is this Project's connection, and a retry that quietly moved you would be a worse
    /// answer than the failure.
    func retryConnection() async {
        await point(at: launch)
    }

    /// A named transcript is an override for the launch target it was named with, so it is not
    /// carried onto a Project the user switched to afterwards.
    private func point(at project: LaunchProject) async {
        launch = project
        let isLaunchTarget = project.url == configuration.projectURL
        await hub.connect(using: engine, configuration: LaunchConfiguration(
            projectURL: project.url,
            transcriptURLs: isLaunchTarget ? configuration.transcriptURLs : [],
        ))
    }

    /// The system panel is the only folder chooser a Mac user should have to learn. Registering a
    /// folder that is not there is not a case to handle — the panel cannot return one.
    private func chooseFolder(prompt: String) -> URL? {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = prompt
        panel.message = "Choose the repository folder."
        guard panel.runModal() == .OK else { return nil }
        return panel.url
    }
}
