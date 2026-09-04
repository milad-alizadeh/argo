import ArgoDesign

/// Every word and mark the archive gesture is drawn with — `SessionRenameProjection`'s counterpart
/// for the roster's other verb, reached from the menu bar and from the row's swipe action.
enum SessionArchiveProjection {
    /// Title Case, as menu items are, and the noun spelled out: a menu carries no row, so the item
    /// has to say what it acts on (#800).
    static func menuTitle(isArchived: Bool) -> String {
        isArchived ? "Put Back on the Roster" : "Archive Session"
    }

    /// The same verb on the row, which is already the Session the menu has to name. The swipe
    /// action is only as wide as its word, so the menu's noun would both repeat the row and
    /// stretch the button past every other one in the cockpit (#1257).
    static func rowTitle(isArchived: Bool) -> String {
        isArchived ? "Put Back" : "Archive"
    }

    static func symbol(isArchived: Bool) -> String {
        isArchived ? ArgoSymbol.unarchive : ArgoSymbol.archive
    }

    /// What the menu item reads with nothing selected — derived, so the disabled item cannot come
    /// to say something the enabled one does not.
    static var fallbackTitle: String {
        menuTitle(isArchived: false)
    }
}
