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
}
