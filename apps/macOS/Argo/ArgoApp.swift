import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The whole app: one window, SwiftUI lifecycle, no AppDelegate.
@main
struct ArgoApp: App {
    @State private var hub: Hub
    @State private var navigation = CockpitNavigationModel()
    private let engine: Engine
    private let configuration: LaunchConfiguration

    init() {
        let currentDirectoryURL = URL(
            fileURLWithPath: FileManager.default.currentDirectoryPath,
            isDirectory: true,
        )
        let configuration = LaunchConfiguration(
            arguments: CommandLine.arguments,
            currentDirectoryURL: currentDirectoryURL,
        )
        self.configuration = configuration
        self.engine = Engine()
        _hub = State(initialValue: Hub(projectURL: configuration.projectURL))
    }

    var body: some Scene {
        Window("Argo", id: "cockpit") {
            if let specimen {
                SpecimenScreen(specimen: specimen)
            } else {
                CockpitView(presentation: presentation, actions: actions)
                    .environment(navigation)
                    .task {
                        await hub.connect(using: engine, configuration: configuration)
                    }
            }
        }
        .defaultSize(width: 1280, height: 800)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
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
        configuration.specimenName.flatMap(Specimen.init(rawValue:))
    }

    private var actions: CockpitActions {
        CockpitActions(
            refreshCheckout: {
                Task { await hub.refreshCheckout(using: engine, at: configuration.projectURL) }
            },
            retryConnection: {
                Task { await hub.connect(using: engine, configuration: configuration) }
            },
        )
    }

    private var presentation: CockpitPresentation {
        CockpitPresentation(
            project: CockpitPresentation.Project(
                name: hub.project.name,
                location: hub.project.url.path,
            ),
            sessions: hub.sessions.map {
                CockpitPresentation.Session(
                    id: $0.id,
                    title: $0.title,
                    model: $0.model,
                    workspaceLocation: $0.cwd,
                    branch: $0.branch,
                    access: .readOnly,
                    operationalState: nil,
                )
            },
            checkout: checkout,
            connection: connection,
        )
    }

    private var checkout: CockpitPresentation.Checkout {
        switch hub.checkout {
        case let .branch(branch): .branch(branch)
        case let .detached(shortSHA): .detached(shortSHA: shortSHA)
        case .unavailable: .unavailable
        }
    }

    private var connection: CockpitPresentation.Connection {
        switch hub.connection {
        case .healthy: .healthy
        case .reconnecting: .reconnecting
        case let .failed(message): .failed(message: message)
        }
    }
}
