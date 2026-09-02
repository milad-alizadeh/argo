/// What deriving the Tickets room COSTS, counted rather than timed (ADR-0028 Rule 8): a count is
/// exactly the same idle and loaded, where a thread-CPU reading on a laptop with five other agents
/// on it is the box as much as the work.
///
/// DEBUG-only storage, the way `SessionsRoomReadingCost` is: nothing outside a suite reads it, and
/// the two charging methods compile to nothing in release.
@MainActor
enum TicketsRoomTally {
    /// The derivations a pass could not avoid: how many, and over how many Tickets between them.
    /// One value because they are one fact — a derivation is never counted without its listing.
    struct Derivations: Equatable {
        /// How many times the room was derived from nothing. A memo hit charges none.
        var times = 0
        /// The listing's size, once per derivation. A derivation walks it several times over (two
        /// filters, five more, the tree, the ranking), so this UNDERSTATES the work and is exactly
        /// proportional to it, which is what a Rule 3 ratio needs.
        var tickets = 0
    }

    /// One reading of the tally. Every figure is a count of Tickets, or of the chart edges between
    /// them — one unit close enough to add, which is what the gate's own quantity does below.
    struct Counts: Equatable {
        var derivations = Derivations()
        /// How many Tickets were looked at to answer which one is open. One per index lookup
        /// (`TicketsListing.item`), so a selection costs the shape of the ticket it opens and not
        /// the size of the listing.
        var looks = 0
        /// How many chart children the hero's ranking examined to place its pool — the index's own
        /// pass over the charts, plus one per ranked item (`TicketChartPlaces`). It grows with the
        /// listing; what it may not do is grow with the listing PER TICKET, which is the quadratic
        /// the index replaced.
        var places = 0
        /// How many Tickets the memo's own key had to walk — the listing's size, charged whenever a
        /// stamp comparison could not be answered by the listing's storage. Zero while the app
        /// hands the same stored array every pass, which it does.
        var compared = 0

        /// What one selection cost, counted in Tickets and in the chart edges between them. The
        /// gate's own quantity: it is the sum because a derivation, a scan, a re-ranking and a key
        /// that walks the listing are one defect at four sites, and a ratio over any one of them
        /// would go green when the work moved to another.
        var tickets: Int {
            derivations.tickets + looks + places + compared
        }
    }

    #if DEBUG
        static var counts = Counts()
    #endif

    /// A derivation over a listing of this size, charged once.
    static func derived(over items: Int) {
        #if DEBUG
            counts.derivations.times += 1
            counts.derivations.tickets += items
        #endif
    }

    /// This many Tickets walked by a stamp comparison the listing's storage could not answer.
    static func compared(_ items: Int) {
        #if DEBUG
            counts.compared += items
        #endif
    }

    /// This many chart children examined while placing a pool.
    static func placed(_ children: Int) {
        #if DEBUG
            counts.places += children
        #endif
    }

    /// One ticket looked at by number.
    static func looked() {
        #if DEBUG
            counts.looks += 1
        #endif
    }

    /// Back to nothing counted. For a suite that needs a cold tally; nothing in the app calls it.
    static func forget() {
        #if DEBUG
            counts = Counts()
        #endif
    }
}
