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
    static func archiveTargets(under row: Row, aimed: Set<String>, in drawn: [Row]) -> [String] {
        drawn
            .filter { aimed.contains($0.id) && $0.isArchived == row.isArchived }
            .map(\.id)
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
