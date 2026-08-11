import ArgoEngine

/// Which of the panel's two lives it is in.
///
/// Project Settings **is** this panel re-entered (#265): same three rows, same order, one word
/// different on the call to action, plus the one row onboarding cannot have. It is a mode rather
/// than a second surface because a second surface is what "no app-global Preferences" rules out —
/// and because two screens drawing three rows each would drift apart by the second change.
///
/// The Agent travels inside the settings case rather than beside the mode, so a panel creating a
/// Project cannot be handed one to draw: a Project that does not exist yet starts no Sessions.
public enum ConnectPanelMode: Equatable, Sendable {
    case creating
    case settings(agent: AgentCLI)
}
