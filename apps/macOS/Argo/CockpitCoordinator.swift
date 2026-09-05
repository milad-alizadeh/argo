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
    /// Every act on the strip moves this and nothing else: the transition table is the value's,
    /// where a test can reach it (#638).
    private(set) var pointing: CockpitPointing

    var registry: ProjectRegistry {
        pointing.registry
    }

    /// What the user said about Sessions, as opposed to what the Hub observed — archived and named.
    /// Per machine and never committed.
    private(set) var annotations = SessionAnnotations.empty

    let hub: Hub
    /// How the active Project's code host reads, injected because a Binding is the ACCOUNTS
    /// coordinator's (#1398). Unbound until it is wired, which reaps nothing.
    var codeHost: @MainActor () async -> BindingResolution = { .unbound }
    /// The CLI's own built-in commands, asked for once per version of it (#686). Held here so the
    /// answer outlives every open of the picker — the read costs a hidden session, and a menu that
    /// waited on one would be a menu nobody uses.
    let builtins: BuiltinCommandReader
    private let store: ProjectRegistryStore
    private let annotationStore: SessionAnnotationStore
    /// The pass that names each Session's ticket (#745). It caches its own reads for the launch, so
    /// asking again as the roster changes costs the code host one request per ticket, not per ask.
    private let ticketTitles: TicketTitleResolver
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
        self.ticketTitles = TicketTitleResolver(annotations: annotationStore)
        self.pointing = CockpitPointing(
            registry: .empty,
            launch: .unregistered(configuration.projectURL),
            launchOrigin: nil,
        )
        self.hub = Hub(
            projectURL: configuration.projectURL,
            engine: engine,
            // The real PTY host is composed in at the app layer: `ArgoTerminal` links SwiftTerm and
            // therefore AppKit, and nothing under `ArgoEngine` may name either.
            spawnServices: SpawnServices(
                // With the emulator the delivery watch reads a composer on (`ComposerEcho`).
                // A Hub given none never reports a Turn lost at all (#1266).
                hosts: SpawnHosts(pty: SwiftTermProcessHost(), screen: SwiftTermScreen()),
                files: SpawnServices.Files(
                    // The one place the real chain file is named. A Hub given none remembers no
                    // handoff.
                    chainFileURL: HandoffChainStore.defaultFileURL,
                    // And the one place the real ownership ledger is. A Hub given none grades every
                    // Session it spawned `external` after a relaunch (ADR-0026).
                    ownershipFileURL: SessionOwnershipLedgerStore.defaultFileURL,
                    // And the one place the real preference is. A Hub given none opens every New
                    // Session on `Code` (#629).
                    modeFileURL: SessionModeStore.defaultFileURL,
                    // And of the Model and Effort last picked. A Hub given none opens every New
                    // Session on `Opus 5 · Medium` (#1175).
                    runFileURL: SessionRunStore.defaultFileURL,
                ),
            ),
        )
        // Composed here for the PTY host's reason, and with a terminal to paint on for the same
        // one: the Help panel exists only once something has rendered it, and the renderer is
        // SwiftTerm.
        self.builtins = BuiltinCommandReader(
            host: SwiftTermProcessHost(),
            screen: SwiftTermScreen(),
        )
    }

    /// The active Project as a record; `nil` where the window points at an unregistered folder,
    /// which has no record for a Binding to be written into.
    var activeRecord: ProjectRecord? {
        registry.project(id: pointing.launch.id)
    }

    /// Read the registry, THEN point the Hub at whatever the launch resolves to: `--project`
    /// overrides the active Project, which is only knowable once the file has been read.
    func start() async {
        let registry = await store.load()
        annotations = await annotationStore.load()
        let resolved = await configuration.resolvingRoots(through: store)
        // Started with the window rather than with the first `/`, so the picker never waits on a
        // hidden `claude` spawning. Its own folder, because that is the one the CLI is trusted in.
        builtins.read(inProjectAt: resolved.projectURL)
        await apply(.launched(
            LaunchProject.resolve(configuration: resolved, registry: registry),
            reading: registry,
        ))
    }

    /// Switching re-points the Hub, which drops the previous Project's tails, roster, checkout and
    /// connection before the new one establishes anything (#418).
    func select(projectID: String) async {
        await apply(.selected(id: projectID))
    }

    /// Registration takes a folder the user chooses, never one the app infers, and activates it.
    func addProject() async {
        guard let folderURL = chooseFolder(prompt: "Register") else { return }
        let registered = await store.register(at: folderURL)
        await apply(.landed(on: registered.project, leaving: registered.registry))
    }

    /// Re-point a Project whose folder has moved. Keyed on the id, so everything linked survives.
    func locateProject(projectID: String) async {
        guard registry.project(id: projectID) != nil,
              let folderURL = chooseFolder(prompt: "Locate")
        else { return }
        let relocated = await store.relocate(id: projectID, to: folderURL)
        // Asked by id rather than taking the store's record: a relocation refused because another
        // Project already holds that root answers the OTHER Project, and this one has not moved.
        await apply(.landed(
            on: relocated.registry.project(id: projectID),
            leaving: relocated.registry,
        ))
    }

    /// Removing the Project on screen lands the window on the registry's new active record.
    /// Removing the LAST one leaves an unregistered pointer at that folder with the Hub let go.
    func removeProject(projectID: String) async {
        guard let record = registry.project(id: projectID) else { return }
        let removed = await store.remove(id: projectID)
        await apply(.removed(record, leaving: removed.registry))
    }

    /// Archive a Session, or put one back. Only ever a gesture on a row; nothing derived from a
    /// merge or a transcript calls this (#502, story 14).
    ///
    /// Archiving a Session Argo OWNS ends its agent first (#1290). The roster is the honest list of
    /// what is running, so a Session that is running and not on it breaks that — and the failure is
    /// silent in the worst way: the row was archived to tidy up and the agent kept working.
    ///
    /// Which way the gesture goes is the Hub's rule, not this method's: archiving a Session Argo
    /// owns ends it, putting one back starts nothing, and a Session it does not own has no process
    /// to end either way. This composes the two writes and decides neither.
    ///
    /// Ended BEFORE the annotation, so the two never disagree in the order that matters. A write
    /// that landed first would take the row off the roster while its agent was still being asked to
    /// stop, which is the state this ticket exists to remove.
    ///
    /// The worktree goes with it where it is Argo's own and its branch has landed (#1398). Last of
    /// the three, because it is the slow one: it may ask the code host, and neither write above
    /// has any reason to wait on that.
    func setArchived(_ isArchived: Bool, sessionID: String) async {
        hub.endSession(archiving: isArchived, id: sessionID)
        annotations = await annotationStore.setArchived(isArchived, sessionID: sessionID)
        await hub.reapWorktree(archiving: isArchived, id: sessionID, through: codeHost)
    }

    /// Name a Session, or drop the name. Only ever the rename dialog: nothing observed names a
    /// Session (#502, story 18).
    func setName(_ name: String?, sessionID: String) async {
        annotations = await annotationStore.setName(name, sessionID: sessionID)
    }

    /// Attach a Session to a Ticket by hand, or drop the attachment (#1092). Only ever the tab
    /// line's picker: nothing observed puts a Session on a Ticket the reader did not name.
    ///
    /// The title behind the number is not read here. Pinning makes the link untitled, and the
    /// window already asks for a resolve the moment an untitled number appears (`ArgoApp`) — one
    /// trigger, so a pinned link and a derived one are named the same way.
    func setPinnedTicket(_ number: Int?, sessionID: String) async {
        annotations = await annotationStore.setPinnedTicket(number, sessionID: sessionID)
    }

    /// Name each Session's ticket through the Project's Ticket port (#745). What is resolved and
    /// what triggers a resolve are both `CockpitPresentation`'s (`+Tickets`).
    ///
    /// A port that is unbound or has come undone resolves nothing and leaves every stored title
    /// where it is: a roster that emptied its rows the moment a Binding lapsed would read as
    /// Sessions losing the work they are on.
    func nameTickets(through resolution: BindingResolution) async {
        guard case let .ready(binding) = resolution else { return }
        // The Binding is immaterial to this one read: an unbound provider turns `unlinked` into
        // `unread`, and neither of those carries a number, so the links are the same either way.
        let links = presentation(.quiet).ticketLinks
        guard !links.isEmpty else { return }
        annotations = await ticketTitles.resolve(links: links, through: binding)
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

    /// Carry out what the act decided: hold the new pointing, persist the one registry write it
    /// asked for, and tell the Hub. Nothing here chooses — every branch was taken in the value.
    private func apply(_ act: CockpitPointing.Act) async {
        let move = pointing.moved(by: act)
        pointing = move.pointing
        if let projectID = move.activates {
            // The store re-reads the file, so its answer carries whatever another window
            // registered since — which the pointing derived above cannot know about.
            pointing = await pointing.reading(store.activate(id: projectID).registry)
        }
        switch move.hub {
        case let .connect(url, carryingLaunchTranscripts):
            await hub.connect(to: LaunchConfiguration(
                projectURL: url,
                transcriptURLs: carryingLaunchTranscripts ? configuration.transcriptURLs : [],
            ))
        case .disconnect:
            await hub.disconnect()
        case .unchanged:
            break
        }
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
