import ArgoEngine

/// What ONE naming pass over a roster settled, held so every surface drawing off that roster reads
/// the answer rather than taking the pass again (#1557).
///
/// The deck header asks for one Session's title. Asked as a lookup, that used to name the whole
/// roster — two listings, every fold folded, a `ticketsDrawn` set over every rival — and then
/// subscript one element out of the answer, on every header pass. The sidebar paid the same fold
/// again, separately, in its own body. So a roster of N Sessions cost three whole-roster passes per
/// window pass, for two surfaces.
///
/// The correctness rule that put the header there is unchanged: the header and the row draw the
/// SAME title (#1391, #1251). That rule wants one shared answer, which is cheaper than two — not a
/// second full pass to index into.
///
/// BOTH of the roster's lists are settled here, because the sidebar draws both and the header may
/// be over either: a value that held one would leave the other asking again. Each array is one
/// naming per Session HANDED IN, in that order — `namings(across:isArchived:)` names every Session
/// it holds, whichever list draws it — so a caller zips it against the same Sessions it built this
/// from and filters afterwards.
struct SessionRosterNamings {
    /// The names these Sessions draw in the roster's own list.
    let onRoster: [SessionTitle.Naming]
    /// The names the same Sessions draw in the list behind the archive foot.
    let archived: [SessionTitle.Naming]

    /// Where one Session sits in the two arrays above, and which of them is the list it is drawn
    /// in. Both facts together because neither answers a title alone.
    private struct Place {
        let row: Int
        let isArchived: Bool
    }

    /// Keyed by id, first spelling winning, exactly as the `firstIndex(where:)` this replaced did:
    /// a roster carrying one id twice draws the first of them and must not change its answer here.
    private let places: [CockpitPresentation.Session.ID: Place]

    init(across sessions: [CockpitPresentation.Session]) {
        self.onRoster = SessionRosterProjection.namings(across: sessions, isArchived: false)
        self.archived = SessionRosterProjection.namings(across: sessions, isArchived: true)
        self.places = Dictionary(
            sessions.enumerated().map { row, session in
                (session.id, Place(row: row, isArchived: session.isArchived))
            },
        ) { first, _ in first }
    }

    /// The namings one of the roster's two passes settled.
    func namings(isArchived: Bool) -> [SessionTitle.Naming] {
        isArchived ? archived : onRoster
    }

    /// The title one Session draws, decided exactly as its roster row's is — the deck header's
    /// route to the SAME answer rather than a second one taken over a different set of rows
    /// (#1391, #1251). `nil` where `id` was not among the Sessions this was built across.
    func title(of id: CockpitPresentation.Session.ID) -> String? {
        places[id].map { namings(isArchived: $0.isArchived)[$0.row].title }
    }
}
