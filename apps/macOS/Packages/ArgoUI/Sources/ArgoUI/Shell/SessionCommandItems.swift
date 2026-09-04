import SwiftUI

/// The Session menu's items — the roster's two gestures, reachable from the keyboard without the
/// pointer ever finding the row. In `ArgoUI` and not beside the `commands` block that mounts it,
/// because it is a View and the app target owns only the `@main` scene (ADR-0022).
public struct SessionCommandItems: View {
    /// What the menu acts on, or `nil` when nothing is selected.
    private let commands: SessionCommands?

    public init(commands: SessionCommands?) {
        self.commands = commands
    }

    /// Absent commands DISABLE the items rather than removing them, so the menu keeps its shape.
    public var body: some View {
        // ⌘R rather than Return: Return belongs to the row that has focus, and a menu item claiming
        // it would fire while somebody was typing in the field it opens.
        Button(SessionRenameProjection.heading) { commands?.rename() }
            .keyboardShortcut("r", modifiers: .command)
            .disabled(commands == nil)
        // ⌘⌫, which is what every macOS list spells "take this out of here" with.
        Button(archiveTitle) { commands?.archive() }
            .keyboardShortcut(.delete, modifiers: .command)
            .disabled(commands == nil)
    }

    private var archiveTitle: String {
        guard let commands else { return SessionArchiveProjection.fallbackTitle }
        return SessionArchiveProjection.menuTitle(isArchived: commands.isArchived)
    }
}
