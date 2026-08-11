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
/// There is deliberately NO companion state for a Session that is starting up. Argo owns the spawn,
/// but nothing tells it when the CLI finished booting — the record does not appear until the first
/// prompt (`HubSession`), so a row keyed on "managed and nothing written yet" would stand over a
/// booted agent waiting at its prompt for the rest of the window's life. That is the false DIRECT
/// the degrade-down rule exists to prevent, and the honest reading of that Session is the one the
/// engine already gives it: idle. The wait before the row exists at all is the toolbar's to report.
enum FeedWorking {
    /// DERIVED, at exactly the confidence `SessionStatus.running` carries and no more: for a
    /// Session observed from outside, a long quiet mid-turn reads as idle, and this row is absent
    /// then rather than asserted over the gap.
    static func isWorking(_ session: CockpitPresentation.Session?) -> Bool {
        session?.status == .running
    }

    /// A sentence, and the only words this state has left: `FeedWorkingThread` says it on screen
    /// with an ion and no caption, and a shape crossing the column is exactly what a screen reader
    /// gets nothing from.
    static let spoken = "The agent is working"
}
