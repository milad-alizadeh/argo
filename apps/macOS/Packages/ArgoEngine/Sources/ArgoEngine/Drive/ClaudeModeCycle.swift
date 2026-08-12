/// Moving a live `claude` along the ladder.
///
/// `--permission-mode` is read at startup and nothing re-reads it, and the TUI exposes exactly one
/// command for the stance — `chat:cycleMode`, bound to `shift+tab`. No command sets a named rung.
enum ClaudeModeCycle {
    /// `ESC [ Z` — `CSI Z`, the back-tab every terminal sends for `shift+tab`.
    static let keystroke = "\u{1B}[Z"

    /// What separates one back-tab from the next.
    ///
    /// The TUI folds every back-tab that arrives in ONE read into a single mode change, so a walk
    /// written as one string moves the Session one rung whatever it was asked for (#653). Spacing
    /// them is the whole mechanism. Verified against `claude` 2.1.228 on 2026-08-12: 15 ms already
    /// walks a three-step change correctly and no gap at all collapses it, so this is that floor
    /// with room for a machine under load.
    static let gap = Duration.milliseconds(50)

    /// How many back-tabs walk a Session from where it stands to `target`, and `nil` for a stance
    /// the ring does not hold. Zero is a real answer: the Session is already there.
    static func steps(from observed: String, to target: SessionMode) -> Int? {
        ClaudePermissionMode.cycles(from: observed, to: target)
    }

    /// The wait between two back-tabs.
    ///
    /// Yielding rather than sleeping, for the reason `LiveClaudeFixture.settle` is: the permission
    /// gate's socket is read by a dispatch source on the main queue, and a walk that sleeps leaves
    /// that queue unserviced for as long as it lasts.
    static func pace(_ duration: Duration = gap) async {
        let deadline = ContinuousClock.now + duration
        while ContinuousClock.now < deadline {
            await Task.yield()
        }
    }
}
