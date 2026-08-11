import SwiftUI

/// What the menu bar can do to the SELECTED Session, published by the shell and read by the app's
/// `commands` block.
///
/// A focused value rather than an action on `CockpitActions`: only the shell knows which Session is
/// selected, and only the shell can open a field inside a row.
///
/// Absent when nothing is selected, which is what greys the items out.
public struct SessionCommands: Equatable, Sendable {
    /// Open the selected row's name field — the same field a double-click opens, in the same row.
    public let rename: @MainActor () -> Void
    /// Clear the selected Session off the roster, or put it back if it is already behind the foot.
    public let archive: @MainActor () -> Void
    /// What the two items are CALLED. Carried here because the Archive's word depends on which way
    /// it goes for this Session, and the Rename's is already spelled in the row's context menu.
    public let renameTitle: String
    public let archiveTitle: String

    /// What the Archive item reads with nothing selected — the item is disabled then, but it is
    /// still on screen, and a menu with a blank line in it reads as broken rather than as inactive.
    public static let archiveFallbackTitle = "Archive Session"

    public init(
        rename: @escaping @MainActor () -> Void,
        archive: @escaping @MainActor () -> Void,
        renameTitle: String,
        archiveTitle: String,
    ) {
        self.rename = rename
        self.archive = archive
        self.renameTitle = renameTitle
        self.archiveTitle = archiveTitle
    }

    /// Closures are not `Equatable`; the titles are the only part that ever changes what is DRAWN,
    /// so they are the only part compared. Two commands for the same Session are the same menu.
    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.renameTitle == rhs.renameTitle && lhs.archiveTitle == rhs.archiveTitle
    }
}

public extension FocusedValues {
    var sessionCommands: SessionCommands? {
        get { self[SessionCommandsKey.self] }
        set { self[SessionCommandsKey.self] = newValue }
    }
}

private struct SessionCommandsKey: FocusedValueKey {
    typealias Value = SessionCommands
}
