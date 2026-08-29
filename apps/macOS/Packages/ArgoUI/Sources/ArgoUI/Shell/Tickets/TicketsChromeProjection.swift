/// What the Tickets room's CHROME draws, off the same room value both panes take — the window's row
/// of controls and the heading over the list, which are two surfaces reading one value.
///
/// A VALUE and not a read of the panes: the count under the heading has to be the count of the rows
/// the list is drawing, and two surfaces counting the same set separately is how a heading comes to
/// disagree with what is under it.
enum TicketsChromeProjection {
    struct Reading: Sendable, Equatable {
        /// What you are looking at. One word, and never enough on its own.
        let heading: String
        /// …and how many, which is the half that stops the heading lying about the filter.
        let subtitle: String
        /// Whether the list-scoped controls stand: the ordering menu and search. They go together
        /// — both address the same list, and with no list there is nothing to address.
        let narrows: Bool
        /// Whether the chrome draws at all, which is also whether New ticket does: the two
        /// coincide, because New ticket survives an empty backlog and the only thing that empties
        /// the chrome is having nothing to create into.
        let draws: Bool
        /// The ticket the verbs address — the one the deck is OPEN on, not the one at the top of
        /// the list.
        let ticket: Int?
        /// Whether the pane draws the reader's fold. A search does not: a folded parent hiding the
        /// only match would leave the heading claiming a result nobody can see (#873).
        var folds = true
        /// What the pane says where the query matched nothing, and `nil` wherever there are rows.
        var empty: String?

        static let none = Reading(
            heading: "", subtitle: "", narrows: false, draws: false, ticket: nil,
        )
    }

    /// The row for a room. `showing` comes from the deck's selection rather than the room, because
    /// the ticket outlives the pane and the verbs address what is open, not what was projected.
    static func reading(
        of room: TicketsRoomProjection.Room,
        in view: TicketsView,
        showing: Int?,
    )
        -> Reading {
        // `room.vacancy` and not a second reading of `provider` and `backlog`: #818 made it the one
        // answer to which of the room's two nothings this is, and a row that decided that for
        // itself could keep New ticket over a provider nobody had asked.
        guard room.vacancy != .unbound else { return .none }
        let hasRows = !room.backlog.isEmpty
        let narrowing = room.narrowing
        // A search that matched nothing keeps the row: without it the field that emptied the list
        // is the one control the reader can no longer reach to clear it.
        let narrows = hasRows || narrowing != nil
        return Reading(
            heading: narrowing == nil ? "Backlog" : "Searching",
            // The VIEW's count, not `backlog.count`: since #814 the backlog is a tree and its top
            // level is the roots, so counting it would report five where the view holds twelve —
            // and would drop by one every time a reader folded a parent. This is the same number
            // the sidebar's row for this view shows, which is what stops the two disagreeing.
            subtitle: subtitle(of: view, in: room),
            narrows: narrows,
            draws: true,
            // `narrows` and not `hasRows`: a query that matched nothing empties the list while the
            // ticket beside it is still open, so the verbs addressing it must not go with the rows.
            ticket: narrows ? showing : nil,
            folds: narrowing == nil,
            empty: hasRows ? nil : narrowing.map { emptied(by: $0, in: view) },
        )
    }

    /// The stated empty for a query that matched nothing — it names the view it searched and
    /// quotes the query, because those are the two things the reader can change.
    private static func emptied(by narrowing: TicketsRoomProjection.Narrowing, in view: TicketsView)
        -> String {
        "No ticket in \(view.name) matches “\(narrowing.query)”."
    }

    /// The middle term names the GROUPING in force, and it is here because #819 put the priority
    /// headers over the list. It was absent through #812 and #814 for the same reason: a heading
    /// reading `by priority` over an ungrouped list is the exact lie the second line exists to
    /// prevent. One grouping today, so it is a constant rather than a parameter — the group-by
    /// control that would make it vary does not choose anything yet.
    private static let grouping = "by priority"

    /// `<view> · by priority · <n> tickets`, and the last term DROPS where the view has no count to
    /// state — the same absence the sidebar's row draws, since the two read one number (#820).
    private static func subtitle(
        of view: TicketsView,
        in room: TicketsRoomProjection.Room,
    )
        -> String {
        let counted = lastTerm(of: view, in: room).map { [$0] } ?? []
        return ([view.name, grouping] + counted).joined(separator: " · ")
    }

    /// Under a query the term counts RESULTS and is never absent: a match is arithmetic this room
    /// did itself, where a view's count rests on edges a provider may not have served. `results`
    /// rather than `tickets` because the rows on screen can exceed it — the rails a match hangs
    /// from are rows and not results (#873).
    private static func lastTerm(
        of view: TicketsView,
        in room: TicketsRoomProjection.Room,
    )
        -> String? {
        if let narrowing = room.narrowing {
            return "\(narrowing.matches) result\(narrowing.matches == 1 ? "" : "s")"
        }
        return room.view(view)?.count.map(tickets)
    }

    private static func tickets(_ count: Int) -> String {
        "\(count) ticket\(count == 1 ? "" : "s")"
    }
}
