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
    ///
    /// Both lists come off `SessionRosterProjection.lists`, which names the roster ONCE for the two
    /// of them and leaves the answer where the deck header reads it too (#1557). `@MainActor` for
    /// that memo, which is what makes this pipeline the one place a pass is taken.
    @MainActor
    func reading(
        of sessions: [CockpitPresentation.Session],
        opened: Set<String> = [],
        selection: String? = nil,
        now: Date = Date(),
    )
        -> Reading {
        let lists = SessionRosterProjection.lists(
            from: sessions, opened: opened, selection: selection, now: now,
        )
        return Reading(rows: order.published(lists.rows), archived: lists.archived)
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
