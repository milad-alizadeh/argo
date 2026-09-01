import SwiftUI

/// What the menu bar can do to the SELECTED Session, published by the shell and read by the app's
/// `commands` block.
///
/// A focused value rather than an action on `CockpitActions`: only the shell knows which Session is
/// selected, and only the shell can open a field inside a row.
///
/// Absent when nothing is selected, which is what greys the items out.
public struct SessionCommands: Equatable, Sendable {
    /// Which Session the two closures below were built for. Carried so that `==` can tell them
    /// apart: the closures capture their Session, and nothing else here changes when the selection
    /// moves from one unarchived Session to another (#806).
    public let sessionID: String
    /// Open the selected row's name field — the same field a double-click opens, in the same row.
    public let rename: @MainActor () -> Void
    /// Clear the selected Session off the roster, or put it back if it is already behind the foot.
    public let archive: @MainActor () -> Void
    /// Which way the Archive item goes. The state and not the word — the words are
    /// `SessionArchiveProjection`'s (#800).
    public let isArchived: Bool

    public init(
        sessionID: String,
        rename: @escaping @MainActor () -> Void,
        archive: @escaping @MainActor () -> Void,
        isArchived: Bool,
    ) {
        self.sessionID = sessionID
        self.rename = rename
        self.archive = archive
        self.isArchived = isArchived
    }

    /// Closures are not `Equatable`, so they are compared through the Session they were built for
    /// and the one drawn fact beside it. Two commands for one Session in one state are the same
    /// menu; two for DIFFERENT Sessions never are, however alike they read (#806).
    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.sessionID == rhs.sessionID && lhs.isArchived == rhs.isArchived
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
