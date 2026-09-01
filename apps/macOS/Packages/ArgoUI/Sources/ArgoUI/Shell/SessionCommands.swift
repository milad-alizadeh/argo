import SwiftUI

/// What the menu bar can do to the SELECTED Session, published by the shell and read by the app's
/// `commands` block.
///
/// A focused value rather than an action on `CockpitActions`: only the shell knows which Session is
/// selected, and only the shell can open a field inside a row.
///
/// Absent when nothing is selected, which is what greys the items out.
public struct SessionCommands: Equatable, Sendable {
    /// Which Session the closures below were built for, and what `==` tells them apart by (#806).
    let sessionID: String
    /// Open the selected row's name field — the same field a double-click opens, in the same row.
    public let rename: @MainActor () -> Void
    /// Clear the selected Session off the roster, or put it back if it is already behind the foot.
    public let archive: @MainActor () -> Void
    /// Which way the Archive item goes. The state and not the word — the words are
    /// `SessionArchiveProjection`'s (#800).
    public let isArchived: Bool

    /// The menu for ONE Session: the id `==` tells two menus apart by and the Session the closures
    /// act on come off the same value here, so no caller can bind them to different Sessions.
    init(
        for session: CockpitPresentation.Session,
        rename: @escaping @MainActor (String) -> Void,
        archive: @escaping @MainActor (String, Bool) -> Void,
    ) {
        self.sessionID = session.id
        self.rename = { rename(session.id) }
        self.archive = { archive(session.id, !session.isArchived) }
        self.isArchived = session.isArchived
    }

    /// Closures are not `Equatable`, so they are compared through the Session they were built for
    /// and the one drawn fact beside it (#806).
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
