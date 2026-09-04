extension SessionRosterProjection {
    /// The row the roster scrolls to when its head moves, or `nil` to leave the offset where it is
    /// (#1235).
    ///
    /// A row added at the head is laid out ABOVE the visible area and the list keeps the offset it
    /// had, which leaves the reader in the middle of the roster with the arriving row cut in half
    /// under the rooms picker.
    ///
    /// A reader who has scrolled owns the offset, so nothing lands there. The first pass answers
    /// `nil` too: with no previous head nothing has been drawn, and a list is already where a
    /// scroll to its head would put it.
    static func topRow(
        whenHeadMovedFrom previous: String?, to leading: String?, isAtTop: Bool,
    )
        -> String? {
        guard isAtTop, let leading, let previous, previous != leading else { return nil }
        return leading
    }
}
