/// What the rename dialog opens with, and every word it says — the roster projection's counterpart
/// for the one surface a row can open.
///
/// A projection rather than a `body` full of literals, for the reason `SessionHeaderProjection`
/// is one: what the field is seeded with, whether a Reset is offered at all, and what that Reset
/// goes back to are DECISIONS, and a decision inside a view is a decision nothing can hold to.
enum SessionRenameProjection {
    /// One Session's rename, as the dialog needs it.
    struct Rename: Equatable, Sendable {
        let sessionID: String
        /// The field's seed: the name on screen right now, whichever of the three it came from.
        /// The dialog opens on what the row says rather than on an empty box — renaming is
        /// usually editing, and a blank field would make every rename a retype.
        let name: String
        /// The title Reset goes back to, and `nil` for a Session that was never renamed — where
        /// there is nothing to undo, there is no control to undo it with.
        ///
        /// Carried as WORDS and not as a flag, because the dialog shows it: after a typo the
        /// original is nowhere else on screen, which is the whole reason story 20 exists.
        let derived: String?
    }

    static let heading = "Rename Session"
    static let prompt = "Session name"
    /// Spelled as what it goes back TO rather than as "Reset" alone, and completed by the title
    /// itself where it is drawn: the control is only ever met once, by somebody who has lost the
    /// name they started with, and by then the derived title is nowhere else on screen.
    static let reset = "Reset to"

    static func rename(for session: CockpitPresentation.Session) -> Rename {
        Rename(
            sessionID: session.id,
            name: SessionTitle.resolved(for: session),
            // Read off the explicit name and not off a comparison of the two: a user who renamed a
            // Session to exactly its derived title has still renamed it, and the record that says
            // so is the one Reset clears.
            derived: session.explicitName == nil ? nil : SessionTitle.fallback(for: session),
        )
    }
}
