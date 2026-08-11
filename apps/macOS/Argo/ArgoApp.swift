import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The whole app: one window, SwiftUI lifecycle, no AppDelegate.
@main
struct ArgoApp: App {
    @State private var cockpit: CockpitCoordinator
    /// The Accounts and Bindings half, over the SAME Project registry the cockpit reads. One store
    /// for both: a Binding is written into `projects.json`, so two stores would be two answers to
    /// where this Project's ports point.
    @State private var accounts: AccountsCoordinator
    @State private var navigation = CockpitNavigationModel()
    /// What the Session menu acts on, published by the shell — absent when nothing is selected.
    @FocusedValue(\.sessionCommands) private var sessionCommands
    private let specimenName: String?

    init() {
        let currentDirectoryURL = URL(
            fileURLWithPath: FileManager.default.currentDirectoryPath,
            isDirectory: true,
        )
        let configuration = LaunchConfiguration(
            arguments: CommandLine.arguments,
            currentDirectoryURL: currentDirectoryURL,
        )
        self.specimenName = configuration.specimenName
        let projects = ProjectRegistryStore()
        _cockpit = State(initialValue: CockpitCoordinator(
            configuration: configuration,
            store: projects,
        ))
        _accounts = State(initialValue: AccountsCoordinator(projects: projects))
    }

    var body: some Scene {
        Window("Argo", id: "cockpit") {
            Group {
                if let specimen {
                    SpecimenScreen(specimen: specimen)
                } else {
                    CockpitView(
                        presentation: cockpit.presentation,
                        actions: actions,
                        connect: connectSurface,
                        health: accounts.connections,
                    )
                    .environment(navigation)
                    .task {
                        cockpit.endOwnedSessionsOnQuit()
                        await cockpit.start()
                        // A machine that has registered nothing has no path forward without
                        // this: the shell it lands in has no Project to act on.
                        await accounts.openIfUnstarted(registry: cockpit.registry)
                    }
                    // Connection health is per-project truth surfaced for the active Project only,
                    // so the chip follows the window rather than each act that moves it. Observed
                    // once here because a change of active Project is ONE event: registering,
                    // switching, relocating and removing all end in it, and a list of acts to
                    // remember is a list the next one is left off.
                    .onChange(of: cockpit.activeRecord?.id, initial: true) { _, _ in
                        Task { await accounts.point(at: cockpit.activeRecord) }
                    }
                    // Every PTY this window owns dies with the window, and the observer above
                    // ends them on ⌘Q too. An agent Argo started must not outlive the Argo that
                    // started it: nothing can re-adopt it, so it would be a process nobody is
                    // left to steer or stop.
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
        .defaultSize(width: 1280, height: 800)
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
            connectAccount: { provider in accounts.connect(provider) },
            bindPort: { binding in Task { await accounts.bind(binding) } },
            unbindPort: { port in Task { await accounts.unbind(port) } },
            stopWaiting: { Task { await accounts.stopWaiting() } },
            finish: { accounts.close() },
        )
    }

    /// An unknown name renders the cockpit rather than failing: the harness names the state, and a
    /// typo there should not look like a launch worth screenshotting.
    private var specimen: Specimen? {
        specimenName.flatMap(Specimen.init(rawValue:))
    }

    private var actions: CockpitActions {
        CockpitActions(
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
            setSessionArchived: { id, isArchived in
                Task { await cockpit.setArchived(isArchived, sessionID: id) }
            },
            setSessionName: { id, name in
                Task { await cockpit.setName(name, sessionID: id) }
            },
            handOffSession: { id, issue in await cockpit.handOff(sessionID: id, issue: issue) },
            sendTurn: { id, text, attachments in
                try cockpit.send(text, attaching: attachments, to: id)
            },
            canAttach: { _ in cockpit.canAttach },
            decidePermission: { id, request, decision in
                cockpit.decide(decision, answering: request, for: id)
            },
            revokeStandingAllow: { id, tool in cockpit.revokeStandingAllow(tool, for: id) },
        )
    }
}
