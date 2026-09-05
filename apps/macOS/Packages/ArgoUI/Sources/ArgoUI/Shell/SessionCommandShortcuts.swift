import SwiftUI

/// Which keys the Session menu answers to. Values rather than modifiers written into the `body`,
/// because SwiftUI gives no way to read a `keyboardShortcut` back off a View and this menu's one
/// rule has to be assertable (#1297).
///
/// The rule: a menu-bar shortcut outranks whichever control has focus, and this window keeps text
/// editors in it — the composer and the rename field. A key macOS has already given to text
/// editing is not free for a menu item to take.
enum SessionCommandShortcuts {
    /// Return belongs to the row that has focus. Text editing does not own ⌘R.
    static let rename = KeyboardShortcut("r", modifiers: .command)

    /// None: ⌘⌫ deletes to the start of the line in a text field (#1297). Archive is reached from
    /// the Session menu and from the row, by pointer.
    static let archive: KeyboardShortcut? = nil
}
