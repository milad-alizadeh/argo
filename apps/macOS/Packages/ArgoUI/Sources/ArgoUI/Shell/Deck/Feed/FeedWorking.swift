import ArgoEngine

/// Whether the Session is working RIGHT NOW, for a feed whose every other row is something it
/// already did.
///
/// Not in the stream, which is why it arrives beside it the way `handedOff` and `expired` do: a
/// transcript is written after the fact, so the whole of a wait is exactly the part of it no record
/// can carry. It exists because the alternative rendering is nothing, and nothing in this feed
/// already means something else — `FeedSilence` says the Session has said nothing, which is true of
/// a Session sitting at its prompt and false of one that is mid-turn.
///
/// Its companion state is `starting`, and a row keyed on "managed and nothing written yet" is what
/// it may NOT be: the record does not appear until the first prompt (`HubSession`), so such a row
/// would stand over a booted agent for the rest of the window's life. What ends this one is bytes
/// on a PTY Argo owns (#587). The wait BEFORE the row exists at all is the toolbar's to report.
enum FeedWorking {
    /// At exactly the confidence `SessionStatus.running` carries and no more: for a Session
    /// observed from outside, a long quiet mid-turn reads as idle, and this row is absent then
    /// rather than asserted over the gap. That confidence is DERIVED for every reading but one —
    /// a Turn Argo itself typed, before the record has answered it, is DIRECT (#1048).
    /// A Turn in progress and nothing else — narrower than `DelegatingSession`, deliberately: a
    /// Session blocked on a permission prompt can still be driving a Subagent, but it is not
    /// mid-Turn, and this row claims it is.
    static func isWorking(_ status: SessionStatus?) -> Bool {
        status == .running
    }

    /// DIRECT, and the engine's own reading, so no surface re-derives it from an empty reading.
    static func isStarting(_ status: SessionStatus?) -> Bool {
        status == .starting
    }

    /// A sentence, and the only words this state has left: `FeedWorkingThread` says it on screen
    /// with an ion and no caption, and a shape crossing the column is exactly what a screen reader
    /// gets nothing from.
    package static let spoken = "The agent is working"

    static let startingSpoken = "The agent is starting"

    /// Words in the rule, unlike the state above: two wordless ions would say neither wait.
    static let startingWords = "starting the agent"
}
