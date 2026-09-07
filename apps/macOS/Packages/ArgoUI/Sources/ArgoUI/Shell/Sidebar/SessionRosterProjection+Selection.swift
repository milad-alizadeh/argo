extension SessionRosterProjection {
    /// The roster's ONE selected state, read by both halves that draw it: the `List`, which is
    /// told which rows it may select at all, and the ground Argo paints as the row's only
    /// selection, the platform's own switched off under it (`argoSelectedRowGround`). Two
    /// readings of "is this row selected" is two selected states on screen the moment they
    /// disagree.
    struct Selection {
        /// What the reader's selection names — the `List`'s binding, verbatim. A set since #1247:
        /// a shift-click selects a range, and the ground is drawn under all of it.
        let rows: Set<String>

        init(rows: Set<String>) {
            self.rows = rows
        }

        /// The one-row selection, which is what every surface outside the roster hands it.
        init(named: String?) {
            self.init(rows: named.map { [$0] } ?? [])
        }

        /// Whether Argo draws its ground under this row — never on a row the `List` could not
        /// have selected, which is what keeps the two on one row.
        func isSelected(_ row: Row) -> Bool {
            row.takesSelection && rows.contains(row.id)
        }
    }

    /// What an Archive pressed on one row acts on (#1247): the rows `aimed` names, cut to the ones
    /// on the SAME side of the foot as the row under the pointer, in the roster's drawn order.
    ///
    /// The two sides are cut apart because the menu says one verb and a count. A selection
    /// spanning the foot would otherwise read "Archive 4 Sessions" over two already archived, and
    /// putting those back is the opposite act.
    ///
    /// **Nothing ships against this any more — `ArchiveAim` below is what the roster draws with,
    /// and this is kept as its reference implementation** (#1559). It states the rule in the one
    /// obvious way, at a cost the view could not pay, and `RosterArchiveAimTests` holds the two
    /// against each other over every row. So a change to the cut belongs HERE FIRST: written into
    /// the aim alone it leaves this asserting the old rule, and written here alone it never
    /// reaches a reader. Either way the equivalence test is what says so.
    static func archiveTargets(under row: Row, aimed: Set<String>, in drawn: [Row]) -> [String] {
        drawn
            .filter { aimed.contains($0.id) && $0.isArchived == row.isArchived }
            .map(\.id)
    }

    /// The same answer for every row, settled in ONE walk of the roster (#1559).
    ///
    /// `archiveTargets` above is a walk of the whole drawn roster, and the row view asked it once
    /// PER ROW — so a roster of N rows cost N², and rebuilt the drawn array N times on the way in.
    /// On the live cockpit at 419 drawn rows that is the heaviest thing Argo's own code does on
    /// the main thread, and it is paid on every list update for a value only a swipe or a menu
    /// ever reads.
    ///
    /// Both sides are settled up front, so a row in the selection reads its side and a row outside
    /// it never looks at the roster at all. Drawn order is kept, because the walk this replaces
    /// returned drawn order and the menu's count is read off it.
    struct ArchiveAim {
        /// The selected rows on each side of the foot, in drawn order. Two lists rather than one
        /// filtered on demand: which side a row is on is the whole of what the cut depends on.
        private let selectedLive: [String]
        private let selectedArchived: [String]
        private let selection: Set<String>

        init(selection: Set<String>, in drawn: [Row]) {
            self.selection = selection
            var live: [String] = []
            var archived: [String] = []
            for row in drawn where selection.contains(row.id) {
                if row.isArchived {
                    archived.append(row.id)
                } else {
                    live.append(row.id)
                }
            }
            self.selectedLive = live
            self.selectedArchived = archived
        }

        /// What an Archive pressed on this row acts on: the whole selection when the row is in it,
        /// cut to the row's own side, and the row alone when it is not — which is `aim(at:)`'s
        /// rule and `archiveTargets`' cut, together.
        func targets(under row: Row) -> [String] {
            guard selection.contains(row.id) else { return [row.id] }
            return row.isArchived ? selectedArchived : selectedLive
        }
    }
}

extension SessionRosterProjection.Row {
    /// Whether the `List` may select this row. A Fold is OPENED, never selected (`CONTEXT.md`
    /// "Surfaces, not entities" · Fold), and a row the platform can highlight while Argo grounds
    /// nothing is a bare `AccentColor` capsule on the rail.
    var takesSelection: Bool {
        fold == nil
    }
}
