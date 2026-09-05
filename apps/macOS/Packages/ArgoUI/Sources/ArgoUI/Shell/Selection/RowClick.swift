import AppKit

/// Which of the three clicks a pointer just made on a list row (#1247).
///
/// A `TapGesture` reports no modifiers, and the two lists have to answer a click themselves — a
/// tap gesture inside a `List` row hit-tests ahead of the row and swallows the click the `List`
/// would have selected with (`SessionRow.clickCatcher`). So the flags are read off the event
/// AppKit is dispatching at that moment, which is the click being handled.
enum RowClick {
    /// No modifier: one row, and the anchor lands on it.
    case plain
    /// Shift: the range from the anchor to this row.
    case extending
    /// Command: this row in or out of the selection on its own.
    case toggling

    /// What the pointer is holding down now. `.shift` outranks `.command` because macOS resolves
    /// the pair that way in every system list.
    static var current: RowClick {
        modifiers(NSEvent.modifierFlags)
    }

    /// Split from `current` so the mapping is provable without an event to hold.
    static func modifiers(_ flags: NSEvent.ModifierFlags) -> RowClick {
        if flags.contains(.shift) {
            return .extending
        }
        return flags.contains(.command) ? .toggling : .plain
    }
}
