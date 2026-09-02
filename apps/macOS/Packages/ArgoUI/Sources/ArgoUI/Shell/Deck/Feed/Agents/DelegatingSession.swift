import ArgoEngine

/// Whether the Session that delegated a Subagent is itself running (`CONTEXT.md` L2 · Session
/// status).
///
/// A Subagent cannot be running when the Session that delegated it is not. The delegating process
/// is what would write the report that ends the call, so a delegation left pending by a Session
/// nobody is running is a record nothing will ever close — never an agent still working. Read each
/// delegation in isolation and the rail counts up from a handover 43 hours old in the running tint
/// (#1076).
///
/// **degrade-down**, and `unknown` is the case it is for: a Session Argo cannot observe resolves to
/// `notRunning`, so it never lends a chip the running dot. So does every quieter status, and so
/// does no Session at all — the rail claims motion only where the Session's own status carries it.
enum DelegatingSession: Equatable, Sendable {
    case running
    case notRunning

    /// DERIVED at exactly the confidence `SessionStatus.running` carries and no more — the same
    /// claim `FeedWorking` draws its live row from, spelled once so the rail and that row cannot
    /// disagree about whether the Session is at work.
    static func of(_ session: CockpitPresentation.Session?) -> DelegatingSession {
        FeedWorking.isWorking(session) ? .running : .notRunning
    }

    var isRunning: Bool {
        self == .running
    }
}
