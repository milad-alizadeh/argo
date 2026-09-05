import SwiftUI

/// The Session menu's items — the roster's two gestures, reachable without the pointer ever finding
/// the row. In `ArgoUI` and not beside the `commands` block that mounts it, because it is a View
/// and the app target owns only the `@main` scene (ADR-0022).
public struct SessionCommandItems: View {
    /// What the menu acts on, or `nil` when nothing is selected.
    private let commands: SessionCommands?

    public init(commands: SessionCommands?) {
        self.commands = commands
    }

    /// Absent commands DISABLE the items rather than removing them, so the menu keeps its shape.
    public var body: some View {
        // Every key here comes from `SessionCommandShortcuts`, Archive's as `nil` (#1297). A
        // literal bound below would archive on ⌘⌫ again and no value test would notice, so
        // `SessionCommandShortcutsTests` reads this file for one.
        Button(SessionRenameProjection.heading) { commands?.rename() }
            .keyboardShortcut(SessionCommandShortcuts.rename)
            .disabled(commands == nil)
        Button(archiveTitle) { commands?.archive() }
            .keyboardShortcut(SessionCommandShortcuts.archive)
            .disabled(commands == nil)
    }

    private var archiveTitle: String {
        guard let commands else { return SessionArchiveProjection.fallbackTitle }
        return SessionArchiveProjection.menuTitle(isArchived: commands.isArchived)
    }
}
