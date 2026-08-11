import Foundation

/// The roster pipeline, whole: project the Sessions into rows, publish them in the order the
/// sidebar is holding, then filter by what was typed.
///
/// The ORDER of those three steps is the whole design, and it used to live only in the order three
/// calls were written in inside `ShellSidebar.body` — where a reordering still renders a roster and
/// no test could tell. Filtering after the publish is what stops a query re-ordering what it
/// leaves; holding over the whole projection rather than the filtered rows is what stops a search
/// shrinking the freeze to the rows it kept.
///
/// Holds the `RosterOrder` rather than sitting beside it, so `hold` and `admit` cannot be handed
/// the wrong list: both take a `Reading`, and the ids come off it.
struct RosterListing {
    /// One pass over the roster.
    struct Reading {
        /// Every kept Session, in the PUBLISHED order and before the query. What a hold and an
        /// admit are taken over.
        let ordered: [SessionRosterProjection.Row]
        /// The rows the query left, in that same order.
        let rows: [SessionRosterProjection.Row]
        /// What is behind the foot: the same query over the archived list, and never held —
        /// nothing down there is under the pointer, so there is no swap to refuse.
        let archived: [SessionRosterProjection.Row]

        /// The published roster's membership, which is what the sidebar watches for a change.
        var ids: [String] {
            ordered.map(\.id)
        }
    }

    private var order = RosterOrder()

    var isHolding: Bool {
        order.isHolding
    }

    func reading(
        of sessions: [CockpitPresentation.Session],
        matching query: String,
        now: Date = Date(),
    )
        -> Reading {
        let ordered = order.published(SessionRosterProjection.rows(from: sessions, now: now))
        return Reading(
            ordered: ordered,
            rows: RosterSearch.matching(query, in: ordered),
            archived: RosterSearch.matching(
                query,
                in: SessionRosterProjection.archivedRows(from: sessions, now: now),
            ),
        )
    }

    /// Takes the freeze at the roster on screen now.
    mutating func hold(_ reading: Reading) {
        order.hold(reading.ids)
    }

    mutating func release() {
        order.release()
    }

    /// Records the membership a held order has already absorbed, so a row admitted once stays
    /// where it was put.
    mutating func admit(_ reading: Reading) {
        order.admit(reading.ids)
    }
}
