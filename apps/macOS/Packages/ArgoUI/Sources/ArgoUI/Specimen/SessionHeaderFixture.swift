import ArgoEngine

/// The Sessions the header specimens are rendered from — one per access posture, plus the one
/// whose branch does not fit.
///
/// A value type beside the view rather than statics inside it, for the reason `PlanFixture` is
/// one: a fixture is data, and data a test reads has no business needing the main actor. The
/// headers are projected here exactly as the shell projects them, so a PNG is evidence about the
/// rendering the app produces rather than about a value a specimen assembled.
enum SessionHeaderFixture {
    /// Every posture's header, in `Access.allCases` order — what the catalog is checked against,
    /// so a posture nothing renders fails a test rather than shipping unlooked-at.
    static let headers = CockpitPresentation.Session.Access.allCases.map(header(for:))

    /// A real branch name off this machine, long enough that the line cannot hold it — the case
    /// story 25 is about. What the PNG settles is that the cut lands on the BRANCH and that the
    /// marks, the model and the issue after it are all still there.
    static let longBranch = SessionHeaderProjection.header(from: session(
        access: .managed,
        title: "Ship the graphite ion-blue scope vessel",
        branch: "worktree-ticket-375-graphite-ion-blue",
    ))

    static func header(for access: CockpitPresentation.Session.Access)
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: access,
            title: title(for: access),
            branch: "argo/#510-session-header-facts",
        ))
    }

    /// The Workspace and the issue are drawn on every posture on purpose: whether a read-only
    /// Session still says what it is working on is exactly what a PNG is for, and a fixture that
    /// only filled the facts in for the managed one would never have shown it.
    private static func session(
        access: CockpitPresentation.Session.Access,
        title: String,
        branch: String,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "header-\(access)",
            title: title,
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: access,
            status: .idle,
            cli: .claude,
            workspace: .init(kind: .worktree, branch: branch, dirty: 3, unpushed: 1),
            issue: .init(
                number: 510,
                title: "The header carries the Session's Workspace, CLI and issue",
            ),
        )
    }

    /// The external one's title is long enough to be CUT at the narrowest deck, deliberately: a
    /// mark that survives only in a wide window is a mark drawn for fixtures, and the render this
    /// exists for is whether `READ-ONLY` still sits beside a title the line could not hold.
    private static func title(
        for access: CockpitPresentation.Session.Access,
    )
        -> String {
        switch access {
        case .managed:
            "Ship the native Liquid Glass application shell with a deliberately long title"
        case .external:
            "Review a Session nobody here started, and decide whether the reading it left "
                + "behind is worth keeping or should be archived tonight"
        case .orphaned:
            "Resume a Session whose terminal Argo lost"
        }
    }
}
