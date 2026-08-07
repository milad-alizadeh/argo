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
                CockpitView(presentation: CockpitPresentation(hub: hub), actions: actions)
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
}
