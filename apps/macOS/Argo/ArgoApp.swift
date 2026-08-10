import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The whole app: one window, SwiftUI lifecycle, no AppDelegate.
@main
struct ArgoApp: App {
    @State private var cockpit: CockpitCoordinator
    @State private var navigation = CockpitNavigationModel()
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
        _cockpit = State(initialValue: CockpitCoordinator(configuration: configuration))
    }

    var body: some Scene {
        Window("Argo", id: "cockpit") {
            if let specimen {
                SpecimenScreen(specimen: specimen)
            } else {
                CockpitView(presentation: cockpit.presentation, actions: actions)
                    .environment(navigation)
                    .task {
                        cockpit.endOwnedSessionsOnQuit()
                        await cockpit.start()
                    }
                    // Every PTY this window owns dies with the window, and the observer above ends
                    // them on ⌘Q too. An agent Argo started must not outlive the Argo that started
                    // it: nothing can re-adopt it, so it would be a process nobody is left to steer
                    // or stop.
                    .onDisappear { cockpit.endOwnedSessions() }
            }
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
        }
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
            spawnSession: { await cockpit.spawnSession() },
            setSessionArchived: { id, isArchived in
                Task { await cockpit.setArchived(isArchived, sessionID: id) }
            },
            handOffSession: { id, issue in await cockpit.handOff(sessionID: id, issue: issue) },
        )
    }
}
