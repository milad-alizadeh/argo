import ArgoEngine

/// Whether the Session that delegated a Subagent is itself running (`CONTEXT.md` L2 · Session
/// status) — the second half of every "still running" claim the rail makes.
///
/// A Subagent cannot be running when the Session that delegated it is not: the delegating process
/// is what would write the report that ends the call, so a delegation left pending by a Session
/// nobody is running is a record nothing will ever close (#1076).
///
/// **degrade-down**, and `unknown` is the case it is for: a Session Argo cannot observe resolves to
/// `notRunning`, as does every quieter status and no Session at all.
enum DelegatingSession: Equatable, Sendable {
    case running
    case notRunning

    /// DERIVED at exactly the confidence `SessionStatus.running` carries and no more, and spelled
    /// through `FeedWorking` so the rail and the feed's live row cannot disagree.
    static func of(_ session: CockpitPresentation.Session?) -> DelegatingSession {
        FeedWorking.isWorking(session) ? .running : .notRunning
    }

    var isRunning: Bool {
        self == .running
    }
}
