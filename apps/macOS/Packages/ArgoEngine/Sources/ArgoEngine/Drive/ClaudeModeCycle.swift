/// Moving a live `claude` along the ladder, as the keystroke a person would use.
///
/// `--permission-mode` is read at startup and nothing re-reads it, and the TUI exposes exactly one
/// command for the stance — `chat:cycleMode`, bound to `shift+tab`. There is no command that SETS a
/// named rung, which is why a change is a distance walked rather than a value written.
enum ClaudeModeCycle {
    /// `ESC [ Z` — `CSI Z`, the back-tab a terminal sends for `shift+tab`. A literal for the reason
    /// `ClaudeTurn`'s paste markers are: every terminal spells it the same way.
    static let keystroke = "\u{1B}[Z"

    /// The keystrokes that walk a Session from where it stands to `target`, and `nil` for a stance
    /// the ring does not hold.
    ///
    /// Sent as ONE write rather than one per step: the TUI reads them in order out of a single
    /// buffer, which keeps the rungs it passes through inside one turn of its own event loop.
    static func keystrokes(from observed: String, to target: SessionMode) -> String? {
        guard let steps = ClaudePermissionMode.cycles(from: observed, to: target)
        else { return nil }
        return String(repeating: keystroke, count: steps)
    }
}
