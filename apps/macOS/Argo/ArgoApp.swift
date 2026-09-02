import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The whole app: one window, SwiftUI lifecycle, no AppDelegate.
@main
struct ArgoApp: App {
    @State private var cockpit: CockpitCoordinator
    /// The Accounts and Bindings half, over the SAME Project registry the cockpit reads: a Binding
    /// is written into `projects.json`, so a second store would be a second answer.
    @State private var accounts: AccountsCoordinator
    @State private var navigation = CockpitNavigationModel()
    /// What the Session menu acts on, published by the shell — absent when nothing is selected.
    @FocusedValue(\.sessionCommands) private var sessionCommands
    private let specimen: SpecimenEntry?

    init() {
        // Settled before anything else is built, and the process may end on it: `specimens.sh`
        // asks the app what it can render rather than parsing Swift source for a list, and a name
        // nothing answers to stops here rather than drawing the cockpit under it. The launch reads
        // its own arguments, so what this target does with them is dispatch (ADR-0022).
        let launch = SpecimenLaunch(
            arguments: CommandLine.arguments,
            currentDirectoryPath: FileManager.default.currentDirectoryPath,
        )
        if let code = launch.ending?.stated() {
            exit(code)
        }
        self.specimen = launch.entry
        let projects = ProjectRegistryStore()
        let cockpit = CockpitCoordinator(configuration: launch.configuration, store: projects)
        let accounts = AccountsCoordinator(projects: projects)
        // The row's fact is the Hub's, read at every panel rebuild rather than copied once.
        accounts.companionStanding = { ConnectCompanion(standing: cockpit.hub.companionStanding) }
        _cockpit = State(initialValue: cockpit)
        _accounts = State(initialValue: accounts)
    }

    var body: some Scene {
        // The window's whole projection, resolved ONCE for the pass and handed to all four readers
        // below — the shell, the ticket-naming observer and the two command menus. Read through a
        // computed property instead, each of the four rebuilt the roster and every projection
        // behind it, and each rebuild cost two `realpath` calls per Session (#959).
        //
        // The Ticket Binding folded in is the Accounts coordinator's, so no surface below can build
        // a second projection that answers differently.
        let presentation = cockpit.presentation(accounts.connections)
        // A rename is the whole of what holds it, and that is not an oversight: no suite can reach
        // this fold. It is a `Scene` body in the app target, which has no unit-test bundle, and it
        // cannot move into ArgoUI — what it folds reads live Hub state, which exactly one file in
        // ArgoUI may do and that file is the projection, not a view (ADR-0022 edge 1). A boundary
        // edge is the only mechanism left for it (#960); see #997 gap 4.
        //
        // Handed on for the same reason, to three of the same readers. Named apart from the
        // property it is read from, so a rename there cannot quietly put the three rebuilds back.
        let actions = cockpitActions

        Window("Argo", id: "cockpit") {
            Group {
                if let specimen {
                    SpecimenScreen(entry: specimen)
                } else {
                    CockpitView(
                        presentation: presentation,
                        actions: actions,
                        connect: connectSurface,
                        readings: ShellReadings(
                            health: accounts.connections,
                            tickets: accounts.tickets,
                            ticketAddress: accounts.ticketAddress,
                        ),
                    )
                    .environment(navigation)
                    .task {
                        cockpit.endOwnedSessionsOnQuit()
                        await cockpit.start()
                        // A machine that has registered nothing has no path forward without
                        // this: the shell it lands in has no Project to act on.
                        await accounts.openIfUnstarted(registry: cockpit.registry)
                    }
                    // Selecting a Session is what makes Argo read its record WHOLE: a sweep
                    // admits every transcript on a bounded read of its two ends, and the feed
                    // needs the stretch that read skipped (`TranscriptExcerpt`). `initial: true`
                    // because launch reconciles onto the first row, and that row is on screen.
                    .onChange(of: navigation.session, initial: true) { _, id in
                        Task { await cockpit.hub.readSelected(sessionID: id) }
                    }
                    // Observed once here because a change of active Project is ONE event:
                    // registering, switching, relocating and removing all end in it.
                    .onChange(of: cockpit.activeRecord?.id, initial: true) { _, _ in
                        Task { await accounts.point(at: cockpit.activeRecord) }
                    }
                    // A Session opening on a branch nobody has read the ticket for is the one
                    // event worth a code-host read (#745). Keyed on the unnamed set rather than on
                    // the roster, so a turn ending on a named ticket asks nothing.
                    .onChange(
                        of: presentation.untitledTicketNumbers,
                        initial: true,
                    ) { _, _ in
                        Task { await cockpit.nameTickets(through: accounts.ticketBinding()) }
                    }
                    // Every PTY this window owns dies with the window, and the observer above ends
                    // them on ⌘Q too: nothing can re-adopt an agent Argo started, so one that
                    // outlived Argo would be a process nobody is left to steer or stop.
                    .onDisappear { cockpit.endOwnedSessions() }
                }
            }
            // The system focus ring, off for the whole window.
            //
            // Almost everything focusable in this cockpit is a CONTAINER made focusable to catch a
            // key — a feed row, the evidence panel, the lightbox — not a control. SwiftUI rings
            // them all the same, and it rings them on a CLICK, so a pointer user who has expressed
            // no interest in the keyboard gets a blue rectangle around whatever they last touched.
            //
            // It is an environment value, so it reaches the specimens as well: a state rendered for
            // review has to be the state that ships, and a ring only the real app draws is a
            // difference no screenshot could report.
            .focusEffectDisabled()
            // Inert unless ARGO_FRAME_PROBE=1 — the measurement rig's only foothold in the app.
            .frameProbe()
        }
        .defaultSize(width: ArgoLayout.windowIdealWidth, height: ArgoLayout.windowIdealHeight)
        // Hidden title bar so the deck's content extends beneath the toolbar region. The chrome
        // bar's ground reaches the top of the WINDOW that way (`ArgoChromeBar`) — with a titlebar
        // in the way, the icons sat on a strip no surface of ours could reach, and the bar read as
        // two pieces however the tones were matched.
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            NewSessionCommands(
                presentation: presentation,
                actions: actions,
                navigation: navigation,
            )
            NavigateCommands(navigation: navigation)
            CommandMenu("Session") { SessionCommandItems(commands: sessionCommands) }
            // In the slot Preferences would have taken, because there is no app-global one.
            ProjectSettingsCommands(presentation: presentation, actions: actions)
        }
    }

    private var connectSurface: ConnectSurface {
        ConnectSurface(
            reading: accounts.reading,
            startsAtWelcome: accounts.startsAtWelcome,
            actions: connectActions,
        )
    }

    /// The panel's intents, split across the two coordinators that own them: the folder is a
    /// Project act and belongs to the cockpit, and everything else is an Account or a Binding.
    private var connectActions: ConnectPanelActions {
        ConnectPanelActions(
            // Registering IS the folder being chosen (ADR-0015), so the panel is handed the
            // Project the pick produced and the button below only closes it.
            chooseFolder: {
                Task {
                    await cockpit.addProject()
                    await accounts.pointed(at: cockpit.activeRecord)
                }
            },
            connectAccount: { provider, port in accounts.connect(provider, for: port) },
            chooseAccount: { port, account in accounts.choose(port: port, account: account) },
            cancelChoice: { Task { await accounts.cancelChoice() } },
            bindPort: { binding in Task { await accounts.bind(binding) } },
            unbindPort: { port in Task { await accounts.unbind(port) } },
            stopWaiting: { Task { await accounts.stopWaiting() } },
            finish: { accounts.close() },
        )
    }

    /// Every act wired to the coordinator that owns it, one group at a time. The Project acts are
    /// the cockpit's except the panel, which is the Accounts coordinator's on the Project the id
    /// names (ADR-0015); the Tickets room's two provider acts split the same way (#872).
    private var cockpitActions: CockpitActions {
        let projectURL = cockpit.hub.project.url
        var actions = CockpitActions(drive: cockpit.hub.driver)
        actions.projects.select = { id in Task { await cockpit.select(projectID: id) } }
        actions.projects.add = { Task { await cockpit.addProject() } }
        actions.projects.locate = { id in Task { await cockpit.locateProject(projectID: id) } }
        actions.projects.reveal = { id in cockpit.revealProject(projectID: id) }
        actions.projects.remove = { id in Task { await cockpit.removeProject(projectID: id) } }
        actions.projects.openPanel = { id in
            Task { await accounts.open(on: id.flatMap(cockpit.registry.project(id:))) }
        }
        actions.retry.checkout = { Task { await cockpit.refreshCheckout() } }
        actions.retry.connection = { Task { await cockpit.retryConnection() } }
        actions.sessions.spawn = { await cockpit.spawnSession() }
        actions.sessions.resume = { id in await cockpit.resumeSession(sessionID: id) }
        actions.sessions.spawnBeside = { id in await cockpit.spawnSession(beside: id) }
        actions.sessions.setArchived = { id, archived in
            Task { await cockpit.setArchived(archived, sessionID: id) }
        }
        actions.sessions.setName = { id, name in
            Task { await cockpit.setName(name, sessionID: id) }
        }
        actions.sessions.clearLostTurn = { id in cockpit.hub.clearLostTurn(for: id) }
        actions.sessions.handOff = { id, issue in
            await cockpit.handOff(sessionID: id, issue: issue)
        }
        actions.composer.skills = { await cockpit.builtins.catalog(forProjectAt: projectURL) }
        actions.composer.workspaceFiles = { root in
            await gitWorkspaceFileRead(URL(fileURLWithPath: root))
        }
        actions.tickets.createTicket = { await accounts.createTicket($0) }
        actions.tickets.startSession = { await cockpit.spawnSession(on: $0, mode: $1, opening: $2) }
        actions.tickets.designedScreens = DesignedScreens(projectURL: projectURL).screens
        actions.tickets.read = { await accounts.read($0) }
        return actions
    }
}
