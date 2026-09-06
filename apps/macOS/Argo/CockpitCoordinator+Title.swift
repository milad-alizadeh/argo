import ArgoEngine

/// Mirroring the name Argo holds onto the CLI's own Session title (#1494), so the same Session
/// reads the same in Argo's roster, Claude mobile, Claude desktop and the web app.
@MainActor
extension CockpitCoordinator {
    /// Type one title at the Session's own prompt, and answer whether it went.
    ///
    /// Every refusal is swallowed: a `codex` Session, a Session Argo owns no terminal for, a Turn
    /// in flight, a Permission or a question holding the keyboard. None of them is a failed rename
    /// — the Argo-side name is written already and is what the roster draws.
    ///
    /// The answer is for the caller that can try again. `TicketTitleResolver` retries a title that
    /// did not go on its next sweep, which is the difference between one busy moment costing a
    /// Session its name for the launch and costing it a few seconds.
    ///
    /// `static`, and handed the Hub rather than reading `self`: it is called from the Ticket title
    /// resolver's mirror, which is built in `init`.
    static func mirrorTitle(_ title: String, to sessionID: String, through hub: Hub) async -> Bool {
        do {
            try await hub.driver.setTitle(title, for: sessionID)
            return true
        } catch {
            return false
        }
    }
}
