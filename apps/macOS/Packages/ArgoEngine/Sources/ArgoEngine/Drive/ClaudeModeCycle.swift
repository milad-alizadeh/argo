/// Moving a live `claude` along the ladder.
///
/// `--permission-mode` is read at startup and nothing re-reads it, and the TUI exposes exactly one
/// command for the stance — `chat:cycleMode`, bound to `shift+tab`. No command sets a named rung.
enum ClaudeModeCycle {
    /// `ESC [ Z` — `CSI Z`, the back-tab every terminal sends for `shift+tab`.
    static let keystroke = "\u{1B}[Z"

    /// The keystrokes that walk a Session from where it stands to `target`, and `nil` for a stance
    /// the ring does not hold. One string, so the TUI reads every step out of a single buffer and
    /// the rungs passed through stay inside one turn of its event loop.
    static func keystrokes(from observed: String, to target: SessionMode) -> String? {
        guard let steps = ClaudePermissionMode.cycles(from: observed, to: target)
        else { return nil }
        return String(repeating: keystroke, count: steps)
    }
}
