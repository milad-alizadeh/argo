import Foundation

/// What separates the interrupt from the Turn that steers past it — see
/// `SessionDriver.steer(_:attaching:to:)`.
///
/// Its own name rather than a literal at the call site, for the reason `ClaudeTurn.gap` has one:
/// it is a claim about what a TUI does with two writes, and a number sitting in an expression is a
/// claim nobody can find to correct.
public enum SessionSteer {
    /// UNMEASURED, unlike `ClaudeTurn.gap` beside it, and it must not be read as though it were.
    /// That one is spaced against a read boundary somebody proved; this one is spaced against a
    /// CLI unwinding whatever the Turn was in the middle of — a tool call, a subagent — and then
    /// drawing its prompt again. Nothing here has measured how long that takes, and it plainly
    /// varies with what was running.
    ///
    /// The value is chosen for the shape of being wrong, not from evidence. Too short and the
    /// paste lands in a prompt still being redrawn, which is the reader's words silently lost —
    /// the failure #682 exists about. Too long and they watch a pause after a click. So it sits
    /// well clear of the 150 ms proved sufficient for the lighter boundary, and the cost of the
    /// headroom is a fifth of a second nobody is blocked on.
    public static let gap = Duration.milliseconds(400)
}
