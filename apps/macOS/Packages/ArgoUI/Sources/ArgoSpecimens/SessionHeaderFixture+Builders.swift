import ArgoEngine
import ArgoUI

/// The builders behind the named fixtures. A file of their own so the catalog can keep growing
/// without either file hitting the length cap that exists to keep a body readable in one screen —
/// these are read once, not browsed. Nothing outside `ArgoSpecimens` calls them.
extension SessionHeaderFixture {
    /// The external posture is given the branch that does not fit, deliberately: the branch sits
    /// immediately BEFORE the access mark on the line, so a long name is what crowds the mark out.
    static func branch(for access: CockpitPresentation.Session.Access) -> String {
        switch access {
        case .external: longBranchName
        case .managed, .orphaned: "argo/#510-session-header-facts"
        }
    }

    /// The Workspace and the issue are drawn on every posture on purpose: whether a read-only
    /// Session still says what it is working on is exactly what a PNG is for.
    static func session(
        access: CockpitPresentation.Session.Access,
        title: String,
        branch: String,
        context: ContextReading = .held(216_764),
        handedOffTo: String? = nil,
        status: SessionStatus = .idle,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "header-\(access)",
            title: title,
            access: access,
            status: status,
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                handoff: .init(handedOffTo: handedOffTo),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/tkt-510",
                workspace: .init(kind: .worktree, branch: branch, dirty: 3, unpushed: 1),
                // A link with no title read through it, which is every Session in this build: no
                // provider is connected (#414), so nothing answers with one.
                ticket: .linked(.init(number: 510)),
            ),
            spend: .init(context: context),
        )
    }

    /// The external one's title is long enough to be CUT at the narrowest deck, deliberately: what
    /// a PNG has to show is that it is cut at the tail rather than wrapping into the line below.
    static func title(
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
