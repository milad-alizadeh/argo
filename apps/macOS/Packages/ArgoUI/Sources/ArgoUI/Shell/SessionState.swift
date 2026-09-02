import ArgoDesign
import ArgoEngine

/// What a Session's status is worth as a colour and as a word — the one decision, in the one place.
/// `cockpit-status-vocabulary.md`'s rule is that a state has exactly one word, identical everywhere
/// it appears, and the roster row and the deck's header both say the state of the same Session.
enum SessionState {
    /// A word and the ink it is set in, together, so no surface pairs a word with a role of its own
    /// choosing.
    struct Reading: Equatable, Sendable {
        let word: String
        /// `nil` for the line's own quiet ink: a tint standing in for a colour the contract does
        /// not carry would be a claim.
        let tone: ArgoOperationalState?
    }

    /// Session status → the four colour roles the visual contract carries. `unknown` takes no role
    /// at all: the contract has no colour for "we cannot say", and the absence is the honest
    /// rendering.
    static func role(for status: SessionStatus) -> ArgoOperationalState? {
        switch status {
        case .running: .running
        case .permission, .asking: .attention
        // `starting` takes the calm ink, not the running one: nothing has been asked of the agent
        // and no Turn is in flight, and the live glow would say one is. What `starting` IS is
        // spelled
        // in the feed, which is the surface that had a wrong word for it (`FeedWorking`, #587).
        case .idle, .ended, .starting: .idle
        case .stopped: .failure
        case .unknown: nil
        }
    }

    /// Session status → the word spent on it, if any. Read off the status rather than the colour
    /// role beside it, so a second status arriving on `.failure` cannot inherit a word that was
    /// never about it — and `Stopped` means the agent stopped short, never that anything crashed
    /// (`CONTEXT.md` L2). The calm states spend nothing.
    static func word(for status: SessionStatus) -> String? {
        switch status {
        case .permission, .asking: "Needs input"
        case .stopped: "Stopped"
        case .running, .idle, .ended, .starting, .unknown: nil
        }
    }

    /// The two together, and `nil` for every status that spends no word — so a surface drawing the
    /// pair cannot render a tint against nothing.
    package static func reading(for status: SessionStatus) -> Reading? {
        guard let word = word(for: status) else { return nil }
        return Reading(word: word, tone: role(for: status))
    }
}
