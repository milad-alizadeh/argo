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

    /// What the launch resolved to, kept for the window's life rather than only while it is on
    /// screen. An unregistered launch target has a mark in the strip, so switching away from it has
    /// to be reversible without a relaunch — and a named transcript belongs to this target alone.
    private(set) var launchOrigin: LaunchProject?

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
        let resolved = await launchConfiguration()
        let origin = LaunchProject.resolve(configuration: resolved, registry: registry)
        launchOrigin = origin
        await point(at: origin)
    }

    /// Switching re-points the Hub, which drops the previous Project's tails, roster, checkout and
    /// connection before the new one establishes anything (#418). Nothing of the old one survives.
    ///
    /// The unregistered launch target is switchable too — its mark is in the strip, and a mark that
    /// did nothing when clicked would be the only dead one there.
    func select(projectID: String) async {
        guard projectID != launch.id else { return }
        if let record = registry.project(id: projectID) {
            registry = await store.activate(id: record.id).registry
            await point(at: .registered(record))
        } else if let origin = launchOrigin, origin.id == projectID {
            await point(at: origin)
        }
    }

    /// Registration is the act that creates a Project, so it is a folder the user chooses and
    /// nothing the app infers. The newly registered Project becomes the active one — offering a
    /// folder and staying where you were would read as the registration not having taken.
    func addProject() async {
        guard let folderURL = chooseFolder(prompt: "Register") else { return }
        let registered = await store.register(at: folderURL)
        registry = registered.registry
        guard let record = registered.project else { return }
        registry = await store.activate(id: record.id).registry
        await point(at: .registered(record))
    }

    /// Re-point a Project whose folder has moved. Keyed on the id, so this is the same Project it
    /// was — everything linked to it survives the move.
    func locateProject(projectID: String) async {
        guard registry.project(id: projectID) != nil,
              let folderURL = chooseFolder(prompt: "Locate")
        else { return }
        let relocated = await store.relocate(id: projectID, to: folderURL)
        registry = relocated.registry
        guard let record = registry.project(id: projectID) else { return }
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

    /// A launch may name, or start in, any folder inside a repository, while the registry holds
    /// roots — so both are resolved before `LaunchProject` matches them. Without it a launch
    /// pointed inside a registered repo draws that repo twice, and a bare launch inside one names
    /// its mark after a subdirectory the Hub is not scoped to.
    private func launchConfiguration() async -> LaunchConfiguration {
        var projectOverrideURL: URL?
        if let overrideURL = configuration.projectOverrideURL {
            projectOverrideURL = await store.projectRoot(of: overrideURL)
        }
        return await LaunchConfiguration(
            launchDirectoryURL: store.projectRoot(of: configuration.launchDirectoryURL),
            projectOverrideURL: projectOverrideURL,
            transcriptURLs: configuration.transcriptURLs,
            specimenName: configuration.specimenName,
        )
    }

    /// A named transcript is an override for the launch target it was named with, so it is not
    /// carried onto a Project the user switched to afterwards.
    private func point(at project: LaunchProject) async {
        launch = project
        let isLaunchTarget = project.url == launchOrigin?.url
        await hub.connect(using: engine, configuration: LaunchConfiguration(
            projectURL: project.url,
            transcriptURLs: isLaunchTarget ? configuration.transcriptURLs : [],
        ))
    }

    /// The system panel is the only folder chooser a Mac user should have to learn.
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
