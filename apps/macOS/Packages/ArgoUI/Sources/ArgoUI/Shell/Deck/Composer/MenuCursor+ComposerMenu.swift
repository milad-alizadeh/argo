/// What the composer's own listing puts under the cursor (#685, #687). The walking itself is
/// `MenuCursor`; this is the one thing about it that knows what a composer row is.
///
/// One cursor serves both composer menus, since only one is ever open: `/` at the head of the
/// line, `@` on a trailing token.
extension MenuCursor where ID == String {
    /// The row ⏎ would take, and `nil` where there is none — which is what leaves the empty
    /// state's Return to the field, so a line nothing matched still sends as written (decision 8).
    func row(in listing: ComposerMenu.Listing) -> ComposerMenu.Row? {
        listing.rows.first { $0.id == current }
    }
}
