import AppKit
import ArgoEngine
import ArgoTerminal
import ArgoUI
import Foundation
import Observation

/// What the window is looking at: the registered set, the active Project, and the Hub on it.
@MainActor
@Observable
final class CockpitCoordinator {
    private(set) var registry = ProjectRegistry.empty
    private(set) var launch: LaunchProject

    /// What the launch resolved to, kept for the window's life: switching away from an unregistered
    /// launch target must be reversible without a relaunch.
    private(set) var launchOrigin: LaunchProject?

    /// What the user said about Sessions, as opposed to what the Hub observed — archived and named.
    /// Per machine and never committed.
    private(set) var annotations = SessionAnnotations.empty

    let hub: Hub
    private let store: ProjectRegistryStore
    private let annotationStore: SessionAnnotationStore
    private let configuration: LaunchConfiguration

    init(
        configuration: LaunchConfiguration,
        engine: Engine = Engine(),
        store: ProjectRegistryStore = ProjectRegistryStore(),
        annotationStore: SessionAnnotationStore = SessionAnnotationStore(),
    ) {
        self.configuration = configuration
        self.store = store
        self.annotationStore = annotationStore
        self.launch = .unregistered(configuration.projectURL)
        self.hub = Hub(
            projectURL: configuration.projectURL,
            engine: engine,
            // The real PTY host is composed in at the app layer: `ArgoTerminal` links SwiftTerm and
            // therefore AppKit, and nothing under `ArgoEngine` may name either.
            spawnServices: SpawnServices(
                host: SwiftTermProcessHost(),
                // The one place the real chain file is named. A Hub given none remembers no
                // handoff.
                chainFileURL: HandoffChainStore.defaultFileURL,
                // And the one place the real ownership ledger is. A Hub given none grades every
                // Session it spawned `external` after a relaunch (ADR-0026).
                ownershipFileURL: SessionOwnershipLedgerStore.defaultFileURL,
            ),
        )
    }

    /// The active Project as a record; `nil` where the window points at an unregistered folder,
    /// which has no record for a Binding to be written into.
    var activeRecord: ProjectRecord? {
        registry.project(id: launch.id)
    }

    /// Read the registry, THEN point the Hub at whatever the launch resolves to: `--project`
    /// overrides the active Project, which is only knowable once the file has been read.
    func start() async {
        registry = await store.load()
        annotations = await annotationStore.load()
        let resolved = await launchConfiguration()
        let origin = LaunchProject.resolve(configuration: resolved, registry: registry)
        launchOrigin = origin
        await point(at: origin)
    }

    /// Switching re-points the Hub, which drops the previous Project's tails, roster, checkout and
    /// connection before the new one establishes anything (#418).
    func select(projectID: String) async {
        guard projectID != launch.id else { return }
        if let record = registry.project(id: projectID) {
            registry = await store.activate(id: record.id).registry
            await point(at: .registered(record))
        } else if let origin = launchOrigin, origin.id == projectID {
            await point(at: origin)
        }
    }

    /// Registration takes a folder the user chooses, never one the app infers, and activates it.
    func addProject() async {
        guard let folderURL = chooseFolder(prompt: "Register") else { return }
        let registered = await store.register(at: folderURL)
        registry = registered.registry
        guard let record = registered.project else { return }
        registry = await store.activate(id: record.id).registry
        await point(at: .registered(record))
    }

    /// Re-point a Project whose folder has moved. Keyed on the id, so everything linked survives.
    func locateProject(projectID: String) async {
        guard registry.project(id: projectID) != nil,
              let folderURL = chooseFolder(prompt: "Locate")
        else { return }
        let relocated = await store.relocate(id: projectID, to: folderURL)
        registry = relocated.registry
        guard let record = registry.project(id: projectID) else { return }
        await point(at: .registered(record))
    }

    /// Removing the Project on screen lands the window on the registry's new active record.
    /// Removing the LAST one leaves an unregistered pointer at that folder with the Hub let go.
    func removeProject(projectID: String) async {
        guard let record = registry.project(id: projectID) else { return }
        let removed = await store.remove(id: projectID)
        registry = removed.registry
        guard projectID == launch.id else { return }
        guard let landing = removed.project else {
            launch = .unregistered(record.url)
            await hub.disconnect()
            return
        }
        await point(at: .registered(landing))
    }

    /// Archive a Session, or put one back. Only ever a gesture on a row; nothing derived from a
    /// merge or a transcript calls this (#502, story 14).
    func setArchived(_ isArchived: Bool, sessionID: String) async {
        annotations = await annotationStore.setArchived(isArchived, sessionID: sessionID)
    }

    /// Name a Session, or drop the name. Only ever the rename dialog: nothing observed names a
    /// Session (#502, story 18).
    func setName(_ name: String?, sessionID: String) async {
        annotations = await annotationStore.setName(name, sessionID: sessionID)
    }

    /// Show a Project's folder in Finder. An unreachable one has nothing to show.
    func revealProject(projectID: String) {
        guard let record = registry.project(id: projectID), record.isReachable else { return }
        NSWorkspace.shared.activateFileViewerSelecting([record.url])
    }

    /// The Hub refreshes itself rather than being told where: `launch.url` is the folder the vessel
    /// names, not the repo the checkout was read from.
    func refreshCheckout() async {
        await hub.refreshCheckout()
    }

    /// Retrying re-points at the Project on screen rather than re-running the launch: the Hub holds
    /// what it was pointed with.
    func retryConnection() async {
        await hub.reconnect()
    }

    /// A launch may name any folder inside a repository while the registry holds roots, so both are
    /// resolved to roots before `LaunchProject` matches them. Without it a launch inside a
    /// registered repo draws that repo twice.
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
        await hub.connect(to: LaunchConfiguration(
            projectURL: project.url,
            transcriptURLs: isLaunchTarget ? configuration.transcriptURLs : [],
        ))
    }

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
