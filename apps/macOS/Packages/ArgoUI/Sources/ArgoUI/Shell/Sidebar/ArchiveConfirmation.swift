/// The archive waiting to be confirmed — every Session with live work in it, held while the prompt
/// is up (#1290, #1247). Not every one of them is ENDED by it: `endsAgent` is which (#1596).
///
/// Every field of a row is captured when the gesture is made rather than read back when the
/// button is pressed. The Sessions are mid-turn, so their rows are moving: a title read a second
/// time could have changed under the prompt, and an id resolved a second time could belong to
/// whatever the roster has since selected. What the reader was asked about is what gets archived.
///
/// `Identifiable` on what it covers, so the two gestures raising it in turn redraw one prompt
/// rather than stacking two.
package struct ArchiveConfirmation: Identifiable, Equatable {
    /// One Session as the prompt names it.
    package struct Session: Equatable {
        package let id: String
        /// Its name as the roster is drawing it, for the prompt's own title.
        package let name: String
        /// Whether archiving this Session ends its agent — true exactly where this window holds
        /// the claim (#1596). Captured with the name and the id, and for the same reason: a claim
        /// can be given up while the prompt is up, and the reader must be held to what they were
        /// actually told.
        package let endsAgent: Bool

        package init(id: String, name: String, endsAgent: Bool) {
            self.id = id
            self.name = name
            self.endsAgent = endsAgent
        }
    }

    package let sessions: [Session]

    package init(sessions: [Session]) {
        self.sessions = sessions
    }

    /// The unit separator, because a Session id may hold anything a folder path can and two
    /// batches must not collide on a joined string.
    package var id: String {
        ids.joined(separator: "\u{1F}")
    }

    package var ids: [String] {
        sessions.map(\.id)
    }

    package var names: [String] {
        sessions.map(\.name)
    }

    /// How many of these agents this window will actually end.
    package var ending: Int {
        sessions.count(where: \.endsAgent)
    }

    /// How many will keep working after the row has gone (#1596).
    package var staying: Int {
        sessions.count - ending
    }
}
