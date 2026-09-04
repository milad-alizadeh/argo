import ArgoEngine

/// What Argo can do to the Turn a Session is ALREADY running — as against `DeckIntents.send`,
/// which starts one.
///
/// One value rather than two closures on the deck, the way `SessionSettingIntents` is one for the
/// three knobs: they are one reading of the Session, they go inert together (a Session with no
/// Turn in flight has neither), and they begin with the same keystroke. Grouping them is also what
/// `swift-boundaries` edge 6 asks of a list this long — one value per reading, never a wider init.
package struct SessionTurnIntents {
    /// Stopping it (#541). A Session blocked on a Permission has nothing to stop.
    package var stop: () throws -> Void = {}
    /// Steering one waiting follow-up into it (#1238): the Turn half of the act, after the caller
    /// has taken `stop` itself.
    ///
    /// Split that way because the interrupt's outcome is what the composer must read — whether a
    /// boundary was claimed, whether the chip may say it is sending — and one throw covering both
    /// halves cannot tell it. What is behind this is the pause the `ESC` needs and then the Turn,
    /// paced by the port (`SessionDriver.steer(_:attaching:to:)`); `async` because that pause is
    /// real, and it belongs beside the keystrokes rather than in a view counting milliseconds.
    var steer: (String, [SessionAttachment]) async throws -> Void = { _, _ in }

    /// Spelled out because Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        stop: @escaping () throws -> Void = {},
        steer: @escaping (String, [SessionAttachment]) async throws -> Void = { _, _ in },
    ) {
        self.stop = stop
        self.steer = steer
    }
}
