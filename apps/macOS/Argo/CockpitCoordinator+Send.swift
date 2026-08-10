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

    /// One Permission answered through the same port. A refusal is dropped, not alerted: the only
    /// one the port can raise here is a decision that lost the race with the hook's own expiry,
    /// and the prompt leaving the screen already says everything there is to say about that.
    func decide(_ decision: PermissionDecision, for sessionID: String) {
        do {
            try hub.driver.decide(decision, for: sessionID)
        } catch {}
    }
}
