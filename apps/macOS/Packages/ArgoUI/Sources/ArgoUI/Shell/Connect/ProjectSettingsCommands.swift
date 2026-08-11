import SwiftUI

/// The menu bar's route into Project Settings, in the slot Preferences would have taken.
///
/// It **replaces** `.appSettings` deliberately. There is no app-global Preferences surface (#265):
/// everything settable is settable about a Project, so the item that would open a window with
/// nothing in it opens this Project's panel instead. `⌘K` rather than `⌘,` for the same reason —
/// this is not the app's settings, and taking the system's key for it would say that it was.
///
/// Disabled with no Project rather than hidden: a verb that vanishes reads as the click having
/// missed, and "there is nothing to configure yet" is a fact worth showing.
public struct ProjectSettingsCommands: Commands {
    public static let label = "Project Settings…"

    private let projectID: String?
    private let open: (String) -> Void

    @MainActor public init(presentation: CockpitPresentation, actions: CockpitActions) {
        // Only a REGISTERED Project has settings: a launch pointed at a folder nobody registered
        // has no record to write a Binding into, and the panel would have nothing to save to.
        self.projectID = presentation.activeProject.flatMap { $0.isRegistered ? $0.id : nil }
        self.open = actions.openProjectSettings
    }

    public var body: some Commands {
        CommandGroup(replacing: .appSettings) {
            Button(Self.label) {
                guard let projectID else { return }
                open(projectID)
            }
            .keyboardShortcut("k", modifiers: .command)
            .disabled(projectID == nil)
        }
    }
}
