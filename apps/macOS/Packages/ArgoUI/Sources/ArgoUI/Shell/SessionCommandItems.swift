import SwiftUI

/// The Session menu's items — the roster's two gestures, reachable from the keyboard without the
/// pointer ever finding the row.
///
/// In `ArgoUI` and not beside the `commands` block that mounts it, because it is a View and the app
/// target owns only the `@main` scene (ADR-0022). That division pays here: the shortcuts and the
/// disabled rule are as testable as any other projection, and the menu's words come from the same
/// place the row's do.
public struct SessionCommandItems: View {
    /// What the menu acts on, or `nil` when nothing is selected.
    private let commands: SessionCommands?

    public init(commands: SessionCommands?) {
        self.commands = commands
    }

    /// Absent commands DISABLE the items rather than removing them: a menu that changed shape as
    /// the selection moved would be a different menu each time somebody looked for it.
    public var body: some View {
        // ⌘R rather than Return: Return belongs to the row that has focus, and a menu item claiming
        // it would fire while somebody was typing in the field it opens.
        Button(commands?.renameTitle ?? SessionRenameProjection.heading) { commands?.rename() }
            .keyboardShortcut("r", modifiers: .command)
            .disabled(commands == nil)
        // ⌘⌫, which is what every macOS list spells "take this out of here" with.
        Button(commands?.archiveTitle ?? SessionCommands.archiveFallbackTitle) {
            commands?.archive()
        }
        .keyboardShortcut(.delete, modifiers: .command)
        .disabled(commands == nil)
    }
}
