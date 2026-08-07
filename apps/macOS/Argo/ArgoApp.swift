import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The whole app: one window, SwiftUI lifecycle, no AppDelegate.
@main
struct ArgoApp: App {
    @State private var hub: Hub
    @State private var room = CockpitRoom.sessions
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
        engine = Engine()
        _hub = State(initialValue: Hub(projectURL: configuration.projectURL))
    }

    var body: some Scene {
        Window("Argo", id: "cockpit") {
            CockpitView(presentation: presentation, room: $room, actions: actions)
                .task {
                    await hub.connect(using: engine, configuration: configuration)
                }
        }
        .defaultSize(width: 1280, height: 800)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            CommandMenu("Navigate") {
                ForEach(CockpitRoom.allCases) { candidate in
                    Button(candidate.title) { room = candidate }
                        .keyboardShortcut(candidate.shortcut, modifiers: .command)
                }
            }
        }
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
                CockpitPresentation.Session(id: $0.id, title: $0.title, branch: $0.branch)
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
