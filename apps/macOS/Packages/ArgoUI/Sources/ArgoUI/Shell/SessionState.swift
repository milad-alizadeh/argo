import ArgoEngine

/// What a Session's status is worth as a colour and as a word — the one decision, in the one place.
///
/// Spelled here rather than inside either projection for the reason `SessionTitle` is: the roster
/// row and the deck's header both say the state of the same Session, and
/// `cockpit-status-vocabulary.md`'s one rule is that a state has exactly one word and that word is
/// identical everywhere it appears. Two copies of the mapping is how a row reading `Needs input`
/// comes to sit under a header reading something else.
enum SessionState {
    /// A word and the ink it is set in, together — the shape a surface that draws the word needs,
    /// so no surface pairs a word with a role of its own choosing.
    struct Reading: Equatable, Sendable {
        let word: String
        /// `nil` for the line's own quiet ink: a word under a status the contract has no colour
        /// for is still a word, and a tint standing in for one would be a claim.
        let tone: ArgoOperationalState?
    }

    /// Session status → the four colour roles the visual contract carries.
    ///
    /// `unknown` takes no role at all: a tint is a claim about what the Session is doing, and the
    /// contract has no colour for "we cannot say". The absence is the honest rendering.
    static func role(for status: SessionStatus) -> ArgoOperationalState? {
        switch status {
        case .running: .running
        case .permission, .asking: .attention
        case .idle, .ended: .idle
        case .stopped: .failure
        case .unknown: nil
        }
    }

    /// Session status → the word spent on it, if any.
    ///
    /// Read off the status rather than off the colour role beside it, so a second status arriving
    /// on `.failure` cannot inherit a word that was never about it — and `Stopped` means the agent
    /// stopped short, never that anything crashed (`CONTEXT.md` L2).
    ///
    /// The calm states spend nothing: a word is spent only where the reader is meant to stop
    /// scanning, which is what keeps `Needs input` worth reading when it appears.
    static func word(for status: SessionStatus) -> String? {
        switch status {
        case .permission, .asking: "Needs input"
        case .stopped: "Stopped"
        case .running, .idle, .ended, .unknown: nil
        }
    }

    /// The two together, and `nil` for every status that spends no word — so a surface drawing the
    /// pair cannot render a tint against nothing.
    static func reading(for status: SessionStatus) -> Reading? {
        guard let word = word(for: status) else { return nil }
        return Reading(word: word, tone: role(for: status))
    }
}
