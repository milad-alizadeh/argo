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
    /// Which way the Archive item goes. The state and not the word — the words are
    /// `SessionArchiveProjection`'s (#800).
    public let isArchived: Bool

    public init(
        rename: @escaping @MainActor () -> Void,
        archive: @escaping @MainActor () -> Void,
        isArchived: Bool,
    ) {
        self.rename = rename
        self.archive = archive
        self.isArchived = isArchived
    }

    /// Closures are not `Equatable`; which way the Archive goes is the only part that changes what
    /// is DRAWN, so it is the only part compared. Two commands for one Session are the same menu.
    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.isArchived == rhs.isArchived
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
