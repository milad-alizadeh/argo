/// The archive waiting to be confirmed — every Session it would end, held while the prompt is up
/// (#1290, #1247).
///
/// Both halves of each row are captured when the gesture is made rather than read back when the
/// button is pressed. The Sessions are mid-turn, so their rows are moving: a title read a second
/// time could have changed under the prompt, and an id resolved a second time could belong to
/// whatever the roster has since selected. What the reader was asked about is what gets archived.
///
/// `Identifiable` on what it covers, so the two gestures raising it in turn redraw one prompt
/// rather than stacking two.
struct ArchiveConfirmation: Identifiable, Equatable {
    /// One Session as the prompt names it.
    struct Session: Equatable {
        let id: String
        /// Its name as the roster is drawing it, for the prompt's own title.
        let name: String
    }

    let sessions: [Session]

    /// The unit separator, because a Session id may hold anything a folder path can and two
    /// batches must not collide on a joined string.
    var id: String {
        ids.joined(separator: "\u{1F}")
    }

    var ids: [String] {
        sessions.map(\.id)
    }

    var names: [String] {
        sessions.map(\.name)
    }
}
