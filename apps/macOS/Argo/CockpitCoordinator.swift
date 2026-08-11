import AppKit
import ArgoEngine
import ArgoTerminal
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

    /// What the user has said about Sessions themselves, as opposed to what the Hub observed of
    /// them: which ones they cleared off the roster, and what they named. Per machine and never
    /// committed, exactly as registration above it is.
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
            // The real PTY host is composed in HERE, at the app layer, which is what keeps the
            // engine runnable with no window: `ArgoTerminal` links SwiftTerm and therefore AppKit,
            // and nothing under `ArgoEngine` names either.
            spawnServices: SpawnServices(
                host: SwiftTermProcessHost(),
                // The one place the real chain file is named. A Hub given none remembers no
                // handoff, which is what every test and the render harness want.
                chainFileURL: HandoffChainStore.defaultFileURL,
            ),
        )
    }

    /// The active Project as a record, and `nil` where the window points at a folder nobody
    /// registered. What the Connect panel needs to bind against: an unregistered pointer has no
    /// record for a Binding to be written into.
    var activeRecord: ProjectRecord? {
        registry.project(id: launch.id)
    }

    /// Read the registry, then point the Hub at whatever the launch resolves to. The read comes
    /// first: `--project` overrides the active Project, and the active Project is only knowable
    /// once the file has been read.
    func start() async {
        registry = await store.load()
        annotations = await annotationStore.load()
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

    /// Removing the Project on screen has to land the window somewhere, so the registry's new
    /// active record is where it goes. Removing the LAST one leaves the cockpit empty and pointed
    /// at nothing registered: an unregistered pointer at the folder it was on, with the Hub let go,
    /// rather than a window still tailing a Project the machine no longer knows.
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

    /// Archive a Session, or put one back. The only path to it, and it is reached from a gesture
    /// on a row — nothing derived from a merge or a transcript calls this (#502, story 14).
    func setArchived(_ isArchived: Bool, sessionID: String) async {
        annotations = await annotationStore.setArchived(isArchived, sessionID: sessionID)
    }

    /// Name a Session, or drop the name it was given. Reached from the dialog a double-click on a
    /// title opens and from nowhere else: nothing observed names a Session (#502, story 18).
    func setName(_ name: String?, sessionID: String) async {
        annotations = await annotationStore.setName(name, sessionID: sessionID)
    }

    /// Show a Project's folder in Finder. An unreachable one has nothing to show, and Finder
    /// answering with a bounce is a worse reading than the row's own "folder not found".
    func revealProject(projectID: String) {
        guard let record = registry.project(id: projectID), record.isReachable else { return }
        NSWorkspace.shared.activateFileViewerSelecting([record.url])
    }

    /// The Hub is asked to refresh itself rather than told where to look: it is the one that knows
    /// which Project it is on, and `launch.url` is the folder the vessel names, not the repo the
    /// checkout was read from.
    func refreshCheckout() async {
        await hub.refreshCheckout()
    }

    /// Retrying re-points at the Project already on screen, rather than re-running the launch: what
    /// failed is this Project's connection, and a retry that quietly moved you would be a worse
    /// answer than the failure. The Hub holds what it was pointed with, so nothing is rebuilt here
    /// that could come out different.
    func retryConnection() async {
        await hub.reconnect()
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
        await hub.connect(to: LaunchConfiguration(
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
