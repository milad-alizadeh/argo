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
        /// How archiving can reach the agent, without two booleans that could contradict each
        /// other. An orphaned Claude process still has to be identified before an end is known.
        package enum AgentEnd: Equatable, Sendable {
            case owned
            case orphanedClaude
            case unavailable
        }

        package let id: String
        /// Its name as the roster is drawing it, for the prompt's own title.
        package let name: String
        /// The route archiving has to its agent (#1596, #1609). Captured with the name and id, and
        /// for the same reason: access can change while the prompt is up, and the reader must be
        /// held to what they were actually told.
        package let agentEnd: AgentEnd

        package init(
            id: String,
            name: String,
            agentEnd: AgentEnd,
        ) {
            self.id = id
            self.name = name
            self.agentEnd = agentEnd
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

    /// How many agents this window owns directly.
    package var owned: Int {
        sessions.count { $0.agentEnd == .owned }
    }

    /// How many agents either have an owned handle or can be sought by an exact argv id.
    package var ending: Int {
        owned + matching
    }

    /// How many have no end route and, as far as Argo can see, keep working after the row is gone.
    package var staying: Int {
        sessions.count - ending
    }

    /// How many orphaned Claude agents must first be identified uniquely in the process table.
    package var matching: Int {
        sessions.count { $0.agentEnd == .orphanedClaude }
    }
}
