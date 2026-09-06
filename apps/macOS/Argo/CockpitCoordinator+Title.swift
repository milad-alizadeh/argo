import ArgoEngine

/// Mirroring the name Argo holds onto the CLI's own Session title (#1494), so the same Session
/// reads the same in Argo's roster, Claude mobile, Claude desktop and the web app.
///
/// One direction only. The annotation store is the roster's single source of truth and nothing here
/// is ever read back into it: two titles that can disagree is the state this ends, and one writer
/// with a mirror ends it where two readers reconciling would not.
///
/// Its own file rather than the coordinator's body, which is at its cap.
@MainActor
extension CockpitCoordinator {
    /// Type one title at the Session's own prompt.
    ///
    /// Every refusal is swallowed, and that is the design: a `codex` Session, a Session Argo owns
    /// no terminal for, a Turn in flight, a Permission or a question holding the keyboard. None of
    /// them is a failed rename — the Argo-side name is written already and is what the roster
    /// draws, so the only thing lost is the copy Claude's other apps would have shown.
    ///
    /// `static`, and handed the Hub rather than reading `self`: it is called from the Ticket title
    /// resolver's mirror, which is built in `init` and must not close over a coordinator that is
    /// not finished being one.
    static func mirrorTitle(_ title: String, to sessionID: String, through hub: Hub) async {
        try? await hub.driver.setTitle(title, for: sessionID)
    }
}
