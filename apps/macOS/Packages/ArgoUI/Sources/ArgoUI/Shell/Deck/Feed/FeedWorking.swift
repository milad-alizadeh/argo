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
/// Its companion state is the BOOT, and it took a signal to earn (#587). A row keyed on "managed
/// and nothing written yet" would never end — the record does not appear until the first prompt
/// (`HubSession`), so it would stand over a booted agent waiting at its prompt for the rest of the
/// window's life, which is the false DIRECT the degrade-down rule exists to prevent. What ends this
/// one is bytes on a PTY Argo owns, witnessed rather than timed: the engine reads that as
/// `starting`
/// and reads `idle` the moment they arrive. The wait BEFORE the row exists at all is still the
/// toolbar's to report.
enum FeedWorking {
    /// DERIVED, at exactly the confidence `SessionStatus.running` carries and no more: for a
    /// Session observed from outside, a long quiet mid-turn reads as idle, and this row is absent
    /// then rather than asserted over the gap.
    static func isWorking(_ session: CockpitPresentation.Session?) -> Bool {
        session?.status == .running
    }

    /// DIRECT, and the engine's own reading: Argo started the process and has heard nothing out of
    /// it. Read off the status like everything else here, so no surface re-derives a boot from
    /// "managed with an empty reading" — the claim this state exists to refuse.
    static func isStarting(_ session: CockpitPresentation.Session?) -> Bool {
        session?.status == .starting
    }

    /// A sentence, and the only words this state has left: `FeedWorkingThread` says it on screen
    /// with an ion and no caption, and a shape crossing the column is exactly what a screen reader
    /// gets nothing from.
    static let spoken = "The agent is working"

    /// The boot's own sentence. It DOES keep a caption on screen, unlike the state above: the two
    /// are told apart by what is being waited on, and a second wordless ion would say neither.
    static let spokenStarting = "The agent is starting"

    /// The words in the rule, lowercase like every other mark's: the record's own machine type,
    /// naming what the wait is for rather than how long it has run.
    static let words = "starting the agent"
}
