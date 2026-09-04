import ArgoDesign
import ArgoEngine

/// What one wait is CALLED — while it runs, once it has settled, and when it failed — and the mark
/// it takes. The one place any of those three sentences is written.
///
/// Three tenses of one act rather than three unrelated strings: the plinth and the row it drops
/// into say the same thing about the same wait, and a reader who saw `Starting the agent` at the
/// foot must find `Started the agent` in the reading. Written apart from `FeedWait` because that
/// type is an identity the reading is compared BY, and words are not part of an identity.
///
/// Two cases today. The design names four waits (`cockpit-feed-waiting.md`), and each of the other
/// two arrives as a case here on its own ticket.
enum FeedWaitWords: Equatable {
    /// Argo started a CLI and has not heard it (#587).
    case starting
    /// A Turn is in flight (#1323). The thread already carries this live, wordless — the plinth
    /// says it again in words, which is the one place the design says a thing twice on purpose.
    case thinking

    /// The wait, live, on the plinth.
    var running: String {
        switch self {
        case .starting: "Starting the agent"
        case .thinking: "Waiting for the agent to answer"
        }
    }

    /// The same wait, over, in the settled row. Unreachable for `.thinking`: the agent's answer IS
    /// the record of it, so a Turn that ends the way it was meant to drops no row for this to say
    /// (`cockpit-feed-waiting.md`) — defined only so the switch stays exhaustive.
    var settled: String {
        switch self {
        case .starting: "Started the agent"
        case .thinking: "The agent answered"
        }
    }

    /// The same wait, failed. It names what did NOT happen rather than repeating the verb: the
    /// reason follows it in machine type, and the sentence has to stand without one.
    var failed: String {
        switch self {
        case .starting: "The agent did not start"
        case .thinking: "The turn ended without an answer"
        }
    }

    /// The act, as a mark — never the state. `startSession`'s play triangle is what Argo DID.
    ///
    /// `nil` for a wait with no mark, and no default is invented for one: a mark is a claim about
    /// what happened, and the mark column is drawn empty rather than filled with a guess, exactly
    /// as `FeedCallLine` draws a call whose kind Argo could not read. `.thinking` takes no mark on
    /// the same ground `FeedMark.working` does: "thinking" is not something that happened.
    var symbol: String? {
        switch self {
        case .starting: ArgoSymbol.startSession
        case .thinking: nil
        }
    }

    /// What a screen reader is told while the wait runs. A sentence rather than the plinth's
    /// caption: the plinth's words are a label on a surface, and this is the whole of what a reader
    /// who cannot see it gets. Taking the word off the screen must not take it off the screen
    /// reader — which is why this sentence outlived the caption in the rule it used to sit in.
    var spokenRunning: String {
        switch self {
        case .starting: "The agent is starting"
        case .thinking: "Waiting for the agent to answer"
        }
    }

    /// Which words a wait Argo is HOLDING takes.
    ///
    /// Exhaustive with no `default`, so a wait added to `FeedWait` has to say what it is called
    /// rather than inheriting a sentence written for another one. `nil` for the one wait read off
    /// the rows that has not reached this surface yet: a lit call takes the ion on its own line
    /// instead of a plinth.
    init?(_ wait: FeedWait) {
        switch wait {
        case .starting: self = .starting
        case .thinking: self = .thinking
        case .call: return nil
        }
    }

    /// Which words a wait that has ENDED takes — the engine's own case, mapped across the seam.
    init(_ wait: SessionWaitSettled.Wait) {
        switch wait {
        case .starting: self = .starting
        case .thinking: self = .thinking
        }
    }
}
