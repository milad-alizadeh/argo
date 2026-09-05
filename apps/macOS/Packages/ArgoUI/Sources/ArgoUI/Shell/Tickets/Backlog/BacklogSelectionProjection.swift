import ArgoEngine

/// Every word the backlog's right-click menu is drawn with, and the words a batch that went partly
/// wrong is reported in (#1247).
///
/// Beside the list rather than in it, for `SessionArchiveProjection`'s reason: a menu carries no
/// rows to point at, so what it says has to state what it covers — and that is a claim a test can
/// reach without rendering a menu.
enum BacklogSelectionProjection {
    /// Title Case, as menu items are, and the noun spelled out (#800). The count appears only
    /// where there is more than one, so the ordinary single-row menu reads as it always did.
    static func deleteTitle(count: Int) -> String {
        count > 1 ? "Delete \(count) Tickets" : "Delete Ticket"
    }

    /// The submenu's own heading. It counts for `deleteTitle`'s reason: the states under it say
    /// what the ticket becomes, and nothing there says how many tickets become it.
    static func markHeading(count: Int) -> String {
        count > 1 ? "Mark \(count) Tickets as" : "Mark as"
    }

    /// One state as the submenu names it. Title Case here and lower case in a sentence
    /// (`TicketWriteError.reason`), which is why the two are not one string.
    static func markTitle(_ state: TicketCanonicalState) -> String {
        switch state {
        case .todo: "To Do"
        case .inProgress: "In Progress"
        case .inReview: "In Review"
        case .done: "Done"
        case .closed: "Closed"
        }
    }

    /// How the act is NAMED when a batch of it went partly wrong. A noun phrase rather than the
    /// menu item's verb, because the report says what the act did not reach.
    static let deleteAct = "The delete"

    static func markAct(_ state: TicketCanonicalState) -> String {
        "The change to \(markTitle(state))"
    }

    /// The states the menu offers, in the order work moves through them rather than the order the
    /// provider happened to declare them — and only the ones this provider can EXPRESS, because a
    /// control drawn over a state nobody can reach is an affordance that lies (ADR-0014).
    static func markable(_ surface: TicketSurface) -> [TicketCanonicalState] {
        TicketCanonicalState.allCases.filter(surface.expresses)
    }
}
