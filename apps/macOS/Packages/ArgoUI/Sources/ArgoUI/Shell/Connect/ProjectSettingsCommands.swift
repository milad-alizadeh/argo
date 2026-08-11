import SwiftUI

/// The menu bar's route into Project Settings, in the slot Preferences would have taken.
///
/// It **replaces** `.appSettings` deliberately. There is no app-global Preferences surface (#265):
/// everything settable is settable about a Project, so the item that would open a window with
/// nothing in it opens this Project's panel instead. `⌘K` rather than `⌘,` for the same reason —
/// this is not the app's settings, and taking the system's key for it would say that it was.
///
/// Never disabled, and that is the point: with no registered Project the same key opens the same
/// panel with nothing set, which is the state that CREATES one (ADR-0015). A shortcut that went
/// dead on the machine with nothing on it would be dead exactly when it is most needed.
public struct ProjectSettingsCommands: Commands {
    public static let label = "Project Settings…"
    /// What the item reads before there is a Project to have settings about. A different verb,
    /// because opening this panel then does a different thing.
    public static let unstartedLabel = "Set Up a Project…"

    private let projectID: String?
    private let open: (String?) -> Void

    @MainActor public init(presentation: CockpitPresentation, actions: CockpitActions) {
        // Only a REGISTERED Project has settings: a launch pointed at a folder nobody registered
        // has no record to write a Binding into, so the panel opens on none and makes one.
        self.projectID = presentation.activeProject.flatMap { $0.isRegistered ? $0.id : nil }
        self.open = actions.openProjectPanel
    }

    public var body: some Commands {
        CommandGroup(replacing: .appSettings) {
            Button(projectID == nil ? Self.unstartedLabel : Self.label) { open(projectID) }
                .keyboardShortcut("k", modifiers: .command)
        }
    }
}
