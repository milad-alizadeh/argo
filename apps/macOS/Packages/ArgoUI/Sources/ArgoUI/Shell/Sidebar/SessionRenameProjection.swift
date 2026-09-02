/// What the rename dialog opens with, and every word it says — the roster projection's counterpart
/// for the one surface a row can open.
enum SessionRenameProjection {
    /// One Session's rename, as the dialog needs it.
    struct Rename: Equatable, Sendable {
        let sessionID: String
        /// The field's seed: the name on screen right now, whichever of the three it came from.
        let name: String
        /// The title Reset goes back to, and `nil` for a Session that was never renamed. Carried as
        /// WORDS and not a flag, because the dialog shows it (story 20).
        let derived: String?
    }

    package static let heading = "Rename Session"
    static let prompt = "Session name"
    /// Spelled as what it goes back TO, and completed by the title itself where it is drawn.
    static let reset = "Reset to"

    /// `naming` is the roster's own decision about this row (`SessionTitle.namings(across:)`) and
    /// not a second reading of it, so the dialog opens on the line that was clicked and Reset
    /// promises the words that line would go back to (#1072).
    static func rename(
        for session: CockpitPresentation.Session, naming: SessionTitle.Naming,
    )
        -> Rename {
        Rename(
            sessionID: session.id,
            name: naming.title,
            // Read off the explicit name and not off a comparison of the two: a user who renamed a
            // Session to exactly its derived title has still renamed it.
            derived: session.explicitName == nil ? nil : naming.resetsTo,
        )
    }
}
