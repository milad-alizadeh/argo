import Foundation

/// The roster pipeline, whole: project the Sessions into rows, then publish them in the order the
/// sidebar is holding.
///
/// Holds the `RosterOrder` rather than sitting beside it, so `hold` and `admit` cannot be handed
/// the wrong list: both take a `Reading`, and the ids come off it.
struct RosterListing {
    /// One pass over the roster.
    struct Reading {
        /// Every kept Session, in the PUBLISHED order. What a hold and an admit are taken over.
        let rows: [SessionRosterProjection.Row]
        /// What is behind the foot, and never held — nothing down there is under the pointer, so
        /// there is no swap to refuse.
        let archived: [SessionRosterProjection.Row]

        /// The published roster's membership, which is what the sidebar watches for a change.
        var ids: [String] {
            rows.map(\.id)
        }
    }

    private var order = RosterOrder()

    var isHolding: Bool {
        order.isHolding
    }

    /// `opened` is the folds the reader has opened (#1073) — the sidebar's own state, passed
    /// through rather than held here: which folds are open is a fact about the window, and this
    /// value is rebuilt every pass.
    func reading(
        of sessions: [CockpitPresentation.Session],
        viewing: SessionRosterProjection.Viewing = .none,
        now: Date = Date(),
    )
        -> Reading {
        Reading(
            rows: order.published(SessionRosterProjection.rows(
                from: sessions, viewing: viewing, now: now,
            )),
            archived: SessionRosterProjection.archivedRows(
                from: sessions, viewing: viewing, now: now,
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
