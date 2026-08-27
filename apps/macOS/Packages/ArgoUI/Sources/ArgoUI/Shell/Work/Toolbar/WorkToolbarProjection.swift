/// What the Work room's toolbar draws, off the same room value both panes take.
///
/// A VALUE and not a read of the panes: the count under the heading has to be the count of the rows
/// the list is drawing, and two surfaces counting the same set separately is how a heading comes to
/// disagree with what is under it.
enum WorkToolbarProjection {
    struct Reading: Sendable, Equatable {
        /// What you are looking at. One word, and never enough on its own.
        let heading: String
        /// …and how many, which is the half that stops the heading lying about the filter.
        let subtitle: String
        /// Whether the list-scoped controls stand: filter, group-by and search. They go together —
        /// each of them narrows the same list, and with no list there is nothing to narrow.
        let narrows: Bool
        /// Whether the row draws at all, which is also whether New ticket does: the two coincide,
        /// because New ticket survives an empty backlog and the only thing that empties the row is
        /// having nothing to create into.
        let draws: Bool
        /// The ticket the verbs address — the one the deck is OPEN on, not the one at the top of
        /// the list.
        let ticket: Int?

        static let none = Reading(
            heading: "", subtitle: "", narrows: false, draws: false, ticket: nil,
        )
    }

    /// The row for a room. `showing` comes from the deck's selection rather than the room, because
    /// the ticket outlives the pane and the verbs address what is open, not what was projected.
    static func reading(
        of room: WorkRoomProjection.Room,
        in view: WorkView,
        showing: Int?,
    )
        -> Reading {
        // `room.vacancy` and not a second reading of `provider` and `backlog`: #818 made it the one
        // answer to which of the room's two nothings this is, and a row that decided that for
        // itself could keep New ticket over a provider nobody had asked.
        guard room.vacancy != .unbound else { return .none }
        let hasRows = !room.backlog.isEmpty
        return Reading(
            heading: "Backlog",
            // The VIEW's count, not `backlog.count`: since #814 the backlog is a tree and its top
            // level is the roots, so counting it would report five where the view holds twelve —
            // and would drop by one every time a reader folded a parent. This is the same number
            // the sidebar's row for this view shows, which is what stops the two disagreeing.
            subtitle: "\(view.name) · \(Self.grouping) · \(tickets(room.view(view)?.count ?? 0))",
            narrows: hasRows,
            draws: true,
            ticket: hasRows ? showing : nil,
        )
    }

    /// The middle term names the GROUPING in force, and it is here because #819 put the priority
    /// headers over the list. It was absent through #812 and #814 for the same reason: a heading
    /// reading `by priority` over an ungrouped list is the exact lie the second line exists to
    /// prevent. One grouping today, so it is a constant rather than a parameter — the group-by
    /// control that would make it vary does not choose anything yet.
    private static let grouping = "by priority"

    private static func tickets(_ count: Int) -> String {
        "\(count) ticket\(count == 1 ? "" : "s")"
    }
}
