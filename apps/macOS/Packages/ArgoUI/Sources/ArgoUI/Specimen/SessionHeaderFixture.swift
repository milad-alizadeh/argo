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

    /// A Session whose record carried almost nothing: no CLI, a model nobody's table knows, no
    /// git read behind it and no issue. The line has to hold its shape with most of it missing,
    /// which is the state a fixture that filled every field in would never have shown.
    static let sparse = SessionHeaderProjection.header(from: CockpitPresentation.Session(
        id: "header-sparse",
        title: "Watch a Session read off a record that said very little",
        model: "some-unreleased-model",
        workspaceLocation: "/Users/milad/Developer/argo",
        access: .external,
        status: .unknown,
    ))

    /// Every shape the fact line takes, for the previews that judge them as a group.
    static let gallery = headers + [longBranch, sparse]

    /// One header per context tier, plus the record that carried no usage at all.
    ///
    /// The numbers are readings off real Sessions on this machine rather than round ones: `67.2k`
    /// and `216.8k` are what the instrument actually has to fit, and a fixture set to `150000`
    /// exactly would render the one reading no real Session ever shows.
    ///
    /// Each is keyed by the catalog case that renders it, so the tier a PNG is named for and the
    /// tier it actually draws cannot drift apart — and so a tier with no case of its own fails a
    /// test rather than shipping unlooked-at.
    static let contexts: [(specimen: Specimen, header: SessionHeaderProjection.Header)] = [
        (.contextOk, header(context: 67175)),
        (.contextWarn, header(context: 216_764)),
        (.contextCrit, header(context: 472_233)),
        (.contextUnknown, header(context: nil)),
    ]

    /// Just the readings, for the preview that judges the four side by side.
    static let contextReadings = contexts.map(\.header.context)

    static func header(for access: CockpitPresentation.Session.Access)
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: access,
            title: title(for: access),
            branch: "argo/#510-session-header-facts",
        ))
    }

    /// A managed Session at a given fullness, with every other fact held still — so a PNG of two
    /// tiers differs in the one thing the tier decides.
    static func header(context tokens: Int?) -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: .managed,
            title: "Ship the native Liquid Glass application shell",
            branch: "argo/#511-header-context-fullness",
            contextTokens: tokens,
        ))
    }

    /// The Workspace and the issue are drawn on every posture on purpose: whether a read-only
    /// Session still says what it is working on is exactly what a PNG is for, and a fixture that
    /// only filled the facts in for the managed one would never have shown it.
    private static func session(
        access: CockpitPresentation.Session.Access,
        title: String,
        branch: String,
        contextTokens: Int? = 216_764,
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
            contextTokens: contextTokens,
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
