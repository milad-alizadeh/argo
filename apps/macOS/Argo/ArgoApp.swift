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
        let currentDirectoryURL = URL(
            fileURLWithPath: FileManager.default.currentDirectoryPath,
            isDirectory: true,
        )
        let configuration = LaunchConfiguration(
            arguments: CommandLine.arguments,
            currentDirectoryURL: currentDirectoryURL,
        )
        // Answered before anything else is built, and the process ends on it: `specimens.sh` asks
        // the app what it can render rather than parsing Swift source for a list.
        if configuration.listsSpecimens {
            for name in SpecimenRegistry.names {
                print(name)
            }
            exit(0)
        }
        // A name nothing answers to ends the launch here, rather than drawing the cockpit under it.
        if let refusal = SpecimenRegistry.refusal(for: configuration.specimenName) {
            FileHandle.standardError.write(Data(refusal.utf8))
            exit(1)
        }
        self.specimen = configuration.specimenName.flatMap(SpecimenRegistry.entry(named:))
        let projects = ProjectRegistryStore()
        let cockpit = CockpitCoordinator(configuration: configuration, store: projects)
        let accounts = AccountsCoordinator(projects: projects)
        // The row's fact is the Hub's, read at every panel rebuild rather than copied once.
        accounts.companionStanding = { ConnectCompanion(standing: cockpit.hub.companionStanding) }
        _cockpit = State(initialValue: cockpit)
        _accounts = State(initialValue: accounts)
    }

    var body: some Scene {
        Window("Argo", id: "cockpit") {
            Group {
                if let specimen {
                    SpecimenScreen(entry: specimen)
                } else {
                    CockpitView(
                        presentation: cockpit.presentation,
                        actions: actions,
                        connect: connectSurface,
                        health: accounts.connections,
                        tickets: accounts.tickets,
                        ticketAddress: accounts.ticketAddress,
                    )
                    .environment(navigation)
                    .task {
                        cockpit.endOwnedSessionsOnQuit()
                        await cockpit.start()
                        // A machine that has registered nothing has no path forward without
                        // this: the shell it lands in has no Project to act on.
                        await accounts.openIfUnstarted(registry: cockpit.registry)
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
                        of: cockpit.presentation.untitledTicketNumbers,
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
                presentation: cockpit.presentation,
                actions: actions,
                navigation: navigation,
            )
            CommandMenu("Navigate") {
                ForEach(CockpitRoom.allCases) { candidate in
                    Button(candidate.title) { navigation.room = candidate }
                        .keyboardShortcut(candidate.shortcut, modifiers: .command)
                }
            }
            CommandMenu("Session") { SessionCommandItems(commands: sessionCommands) }
            // In the slot Preferences would have taken, because there is no app-global one.
            ProjectSettingsCommands(presentation: cockpit.presentation, actions: actions)
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

    private var actions: CockpitActions {
        var actions = CockpitActions(
            refreshCheckout: { Task { await cockpit.refreshCheckout() } },
            retryConnection: { Task { await cockpit.retryConnection() } },
            selectProject: { id in Task { await cockpit.select(projectID: id) } },
            addProject: { Task { await cockpit.addProject() } },
            locateProject: { id in Task { await cockpit.locateProject(projectID: id) } },
            revealProject: { id in cockpit.revealProject(projectID: id) },
            removeProject: { id in Task { await cockpit.removeProject(projectID: id) } },
            openProjectPanel: { id in
                Task { await accounts.open(on: id.flatMap(cockpit.registry.project(id:))) }
            },
            spawnSession: { await cockpit.spawnSession() },
            resumeSession: { id in await cockpit.resumeSession(sessionID: id) },
            spawnSessionBeside: { id in await cockpit.spawnSession(beside: id) },
            setSessionArchived: { id, isArchived in
                Task { await cockpit.setArchived(isArchived, sessionID: id) }
            },
            setSessionName: { id, name in
                Task { await cockpit.setName(name, sessionID: id) }
            },
            clearLostTurn: { id in cockpit.hub.clearLostTurn(for: id) },
            handOffSession: { id, issue in await cockpit.handOff(sessionID: id, issue: issue) },
            drive: cockpit.hub.driver,
            // The skills are read on every call, off the Project the window is pointed at — which
            // is what puts a skill installed while a Session is open in the very next list (#685).
            // The Hub's own folder rather than the registry's record: an unregistered folder is
            // still a checkout with `.claude/skills` in it.
            //
            // The CLI's own built-ins are NOT re-read here (#686). They are keyed to a version
            // rather than to a moment, and asking again would mean a hidden `claude` per keystroke.
            skills: {
                cockpit.builtins.catalog(
                    joining: SkillCatalog(projectURL: cockpit.hub.project.url).skills(),
                )
            },
            // The Session's OWN folder, not the Project's: a Session running in a worktree names
            // files in that worktree, and nothing outside it (#687). Read on every open, so a file
            // written while the Session was running is in the very next list.
            workspaceFiles: { root in
                await gitWorkspaceFileRead(URL(fileURLWithPath: root))
            },
        )
        // The Work room's two provider acts, split across the coordinators that own them the way
        // the Connect panel's are: the create is a Binding act, and the spawn is the Hub's (#872).
        actions.work.createTicket = { await accounts.createTicket($0) }
        actions.work.startSession = { await cockpit.spawnSession(on: $0, mode: $1) }
        return actions
    }
}
