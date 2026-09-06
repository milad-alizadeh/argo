import ArgoEngine

/// Which rows a Ticket's words are spent against — split off `SessionRosterProjection.swift` so
/// neither file owns two subjects.
///
/// `SessionTitle` spends a Ticket's words only where they name ONE row (#1072). WHICH rows are
/// counted is this file's question, and the answer is the rows the reader sees BESIDE each other
/// (#1251): a row behind the archive foot, and a run a fold hides, were each taking the words off
/// a row on screen, which left that row on its derived name with nothing to explain it.
///
/// So the rows are named in GROUPS, and a group inherits the ones drawn above it: the roster's own
/// rows are the first group; the archive is a second that also sees the roster's; each fold is a
/// group that sees its list's rows and its own runs. Every group's membership is the FOLD's rather
/// than the reader's opened folds, so no title moves as a fold opens — which is what keeps the deck
/// header, which reads no fold at all, drawing what the row draws.
extension SessionRosterProjection {
    /// The title one Session draws, decided exactly as its roster row's is — the deck header's
    /// route to the SAME answer rather than a second one taken over a different set of rows
    /// (#1391, #1251). `nil` where `id` is not in `sessions`.
    package static func namedTitle(
        for id: CockpitPresentation.Session.ID, among sessions: [CockpitPresentation.Session],
    )
        -> String? {
        guard let row = sessions.firstIndex(where: { $0.id == id }) else { return nil }
        return namings(across: sessions, isArchived: sessions[row].isArchived)[row].title
    }

    /// The name each of these Sessions draws in one of the roster's two passes — the ONE place the
    /// rows being named are put to the rows that contest them, so no second caller can pair them
    /// differently.
    static func namings(
        across sessions: [CockpitPresentation.Session], isArchived: Bool,
    )
        -> [SessionTitle.Naming] {
        let roster = listing(among: sessions, isArchived: false)
        let listing = isArchived ? listing(among: sessions, isArchived: true) : roster
        let drawn = isArchived ? roster.drawn + listing.drawn : roster.drawn
        var folded: [String: SessionTitle.Naming] = [:]
        for runs in listing.folds {
            // The fold's runs are drawn beside each other and nowhere near the roster's own rows,
            // so they contest each other — and, whatever their number, take nothing off a row
            // above them.
            for (run, naming) in zip(runs, SessionTitle.namings(of: runs, against: drawn + runs)) {
                folded[run.id] = naming
            }
        }
        return zip(sessions, SessionTitle.namings(of: sessions, against: drawn))
            .map { session, naming in folded[session.id] ?? naming }
    }

    /// One of the roster's two lists, split into the groups its rows are named in.
    private struct Listing {
        /// The rows the list draws: every run outside a fold.
        let drawn: [CockpitPresentation.Session]
        /// The runs each fold holds, one group per fold.
        let folds: [[CockpitPresentation.Session]]
    }

    /// The split above, taken with no fold OPENED and nothing selected: both are the reader's own
    /// state, and a title that moved as they changed it would leave the header out of step.
    private static func listing(
        among sessions: [CockpitPresentation.Session], isArchived: Bool,
    )
        -> Listing {
        let kept = sessions.filter { $0.isArchived == isArchived }
        let folding = Folding(
            of: kept, in: Pass(isArchived: isArchived, opened: [], selection: nil),
        )
        let byID = Dictionary(kept.map { ($0.id, $0) }) { first, _ in first }
        // Keyed off the run that OPENS each fold, so a fold's runs are gathered once rather than
        // once per run.
        let folds = kept
            .filter { folding.fold(opening: $0) != nil }
            .map { folding.runs(foldedWith: $0).compactMap { byID[$0] } }
        return Listing(drawn: kept.filter(folding.drawsOwnRow), folds: folds)
    }
}
