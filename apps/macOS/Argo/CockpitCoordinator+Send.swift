import ArgoEngine

/// Putting the user's words to a Session — the composer's one intent, performed here for the
/// reason every intent is: the shell decides what is being asked for, the app reaches the Hub.
@MainActor
extension CockpitCoordinator {
    /// One Turn through the drive port. A refusal is thrown back rather than alerted: the words
    /// are still in the field, and the composer's own seam is where the reason belongs (#538).
    func send(_ text: String, to sessionID: String) throws {
        try hub.driver.send(text, to: sessionID)
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
