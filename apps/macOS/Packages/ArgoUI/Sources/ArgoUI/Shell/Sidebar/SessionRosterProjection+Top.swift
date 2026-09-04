extension SessionRosterProjection {
    /// The row the roster scrolls back to when its head moves, or `nil` to leave the offset where
    /// it is (#1235).
    ///
    /// A Session added at the head is drawn ABOVE the visible area: a list keeps the offset it
    /// had, so the reader is left in the middle of the roster with the arriving row cut in half
    /// under the rooms picker — the Session it was announcing, unreadable.
    ///
    /// Only from the top, and that is the whole rule. A reader who has scrolled owns the offset,
    /// and moving the rows under their pointer to announce somebody else's Session is worse than
    /// not announcing it.
    ///
    /// The first pass answers `nil` too: a roster with no previous head has drawn nothing, and a
    /// list at its top is already where a scroll would put it.
    static func returnToTop(from previous: String?, to leading: String?, isAtTop: Bool) -> String? {
        guard isAtTop, let leading, let previous, previous != leading else { return nil }
        return leading
    }
}
