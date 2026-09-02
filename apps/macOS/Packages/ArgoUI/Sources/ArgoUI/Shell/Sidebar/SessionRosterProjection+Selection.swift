extension SessionRosterProjection {
    /// The roster's ONE selected state, read by both halves that draw it: the `List`, which is
    /// told which rows it may select at all, and the ground Argo paints over the platform's own
    /// capsule (`argoSelectedRowGround`). Two readings of "is this row selected" is two selected
    /// states on screen the moment they disagree.
    struct Selection {
        /// What the reader's selection names — the `List`'s binding, verbatim.
        let named: String?

        /// Whether Argo draws its ground under this row — never on a row the `List` could not
        /// have selected, which is what keeps the two on one row.
        func isSelected(_ row: Row) -> Bool {
            row.takesSelection && row.id == named
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
