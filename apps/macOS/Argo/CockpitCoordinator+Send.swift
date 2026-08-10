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
}
