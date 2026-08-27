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
        /// Whether New ticket stands. It survives an empty backlog, which is the one moment you
        /// most want it.
        let creates: Bool
        /// The ticket the verbs address — the one the deck is OPEN on, not the one at the top of
        /// the list.
        let ticket: Int?

        /// Whether the row draws at all. False only with nothing bound: there is no list, no
        /// ticket, and nothing to create into.
        var draws: Bool {
            creates
        }

        /// The empty row. Named rather than spelled at each vacancy, so the two of them cannot
        /// drift apart.
        static let none = Reading(
            heading: "", subtitle: "", narrows: false, creates: false, ticket: nil,
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
        guard room.provider != nil else { return .none }
        let hasRows = !room.backlog.isEmpty
        return Reading(
            heading: "Backlog",
            subtitle: "\(view.name) · \(tickets(room.backlog.count))",
            narrows: hasRows,
            creates: true,
            ticket: hasRows ? showing : nil,
        )
    }

    /// The design's subtitle reads `All open · by priority · 12 tickets`, and the middle term is
    /// missing here on purpose: it names the grouping in force, and the list is still flat (#812).
    /// A heading that said `by priority` over an ungrouped list would be the exact lie the second
    /// line exists to prevent — #814 adds the term with the grouping it describes.
    private static func tickets(_ count: Int) -> String {
        "\(count) ticket\(count == 1 ? "" : "s")"
    }
}
