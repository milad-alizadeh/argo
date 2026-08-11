import ArgoEngine

/// Putting the user's words to a Session — the composer's one intent, performed here for the
/// reason every intent is: the shell decides what is being asked for, the app reaches the Hub.
@MainActor
extension CockpitCoordinator {
    /// One Turn through the drive port. A refusal is thrown back rather than alerted: the words
    /// are still in the field, and the composer's own seam is where the reason belongs (#538).
    /// The attachments go first and the Turn NAMES what they became (#540) — one Turn carrying the
    /// message and the paths, so the agent's own `Read` is what pulls the bytes in. Both halves are
    /// on the same throwing path: a write that failed must not be followed by a message pointing at
    /// a file that is not there.
    func send(_ text: String, attaching attachments: [SessionAttachment], to sessionID: String)
        throws {
        let paths = try hub.driver.attach(attachments, to: sessionID)
        try hub.driver.send(SessionTurn.text(text, attaching: paths), to: sessionID)
    }

    /// Stop the Turn a Session is running (#541).
    ///
    /// A refusal is dropped rather than alerted, for the reason `decide`'s is: the only one the
    /// port raises is the Session having gone, and a Session that has gone takes its whole
    /// composer off the screen — the answer is already on the way, in the control disappearing.
    func interrupt(_ sessionID: String) {
        do {
            try hub.driver.interrupt(sessionID)
        } catch {}
    }

    /// What the composer asks before it draws the `+`. Off the same adapter the send goes through,
    /// so the control and the refusal cannot disagree about what a Session can take.
    ///
    /// Not keyed by Session, because the Hub has ONE adapter — `AgentCLI` has one case, and the
    /// day a second CLI can be spawned this becomes a read of the Session's own `cli` in the same
    /// place `Hub.driver` becomes a choice, rather than in two.
    var canAttach: Bool {
        hub.driver.canAttach
    }

    /// One named Permission answered through the same port. A refusal is dropped rather than
    /// alerted, and both of the port's refusals mean the same thing here: the Permission that
    /// button was drawn for is gone — expired, cancelled with its turn, or taken down with the PTY
    /// — and the prompt leaving the screen says it. There is no field holding words that a seam
    /// would have to explain.
    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) {
        do {
            try hub.driver.decide(decision, answering: requestID, for: sessionID)
        } catch {}
    }

    /// One standing allow taken back (#572).
    ///
    /// The port refuses a grant it does not hold — `noSuchGrant` — and this drops it, which is not
    /// the contradiction it looks like. The refusal is there so a CALLER cannot revoke into thin
    /// air and believe it worked; the cockpit is the one caller that already knows, because the
    /// tray is re-derived from the Session and the chip goes either way. There is no field holding
    /// words, so there is no seam for a reason to sit on.
    func revokeStandingAllow(_ toolName: String, for sessionID: String) {
        do {
            try hub.driver.revokeStandingAllow(toolName, for: sessionID)
        } catch {}
    }
}
