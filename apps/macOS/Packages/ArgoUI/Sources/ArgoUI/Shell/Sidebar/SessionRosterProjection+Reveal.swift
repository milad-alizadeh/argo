extension SessionRosterProjection {
    /// The row the roster scrolls into view for a selection, or `nil` to leave the offset where it
    /// is (#1273).
    ///
    /// The selection is written from surfaces that are not the roster — the Tickets room's
    /// claimant line, the feed's handoff mark, the menu bar — and each of those leaves the mark on
    /// a row that can be anywhere in a roster of a hundred and eighty. A mark drawn out of view
    /// answers "which Session am I in" no better than no mark at all.
    ///
    /// Answered off the rows the roster is DRAWING, not off the Sessions it holds: a selection
    /// behind a shut foot or inside a shut fold carries no row, and asking the list to scroll to
    /// a row it is not drawing moves the offset for a mark that is not there. `takesSelection` is
    /// the same gate the ground is drawn behind (`Selection.isSelected`), so the two cannot pick
    /// different rows.
    static func rowToReveal(for selection: String?, among drawn: [Row]) -> String? {
        guard let selection else { return nil }
        return drawn.first { $0.takesSelection && $0.id == selection }?.id
    }
}
