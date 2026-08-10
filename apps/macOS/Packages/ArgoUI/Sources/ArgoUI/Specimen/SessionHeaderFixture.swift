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
    /// story 25 is about.
    static let longBranchName = "worktree-ticket-375-graphite-ion-blue"

    /// What the PNG settles is that the cut lands on the BRANCH and that the marks, the model and
    /// the issue after it are all still there.
    static let longBranch = SessionHeaderProjection.header(from: session(
        access: .managed,
        title: "Ship the graphite ion-blue scope vessel",
        branch: longBranchName,
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

    /// Every state the handoff offer has, keyed by the case that renders it.
    ///
    /// The first is the one with NOTHING in it, and it is here on purpose: story 44 is a claim
    /// about an absence, and an absence has to be looked at on the same line as the presence to be
    /// judged at all. The last two are the same reading on a Session Argo cannot drive — the
    /// warning without the button (story 49), which no value test can show is still legible.
    static let handoffs: [(specimen: Specimen, header: SessionHeaderProjection.Header)] = [
        (.handoffWithheld, header(context: 67175)),
        (.handoffAtWarn, header(context: 216_764)),
        (.handoffAtCrit, header(context: 472_233)),
        (.handoffOnReadOnly, header(context: 216_764, access: .external)),
        (.handoffOnOrphaned, header(context: 472_233, access: .orphaned)),
    ]

    /// The button's own states for the preview that judges the three side by side — amber, red, and
    /// the one that is drawn and out of reach.
    static let handoffOffers: [SessionHeaderProjection.Handoff] = [
        header(context: 216_764).handoff,
        header(context: 472_233).handoff,
        SessionHeaderProjection.handoff(from: CockpitPresentation.Session(
            id: "header-folderless",
            title: "A Session whose folder Argo never read",
            model: "claude-opus-5",
            workspaceLocation: nil,
            access: .managed,
            status: .idle,
            contextTokens: 216_764,
        )),
    ].compactMap(\.self)

    static func header(for access: CockpitPresentation.Session.Access)
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: access,
            title: title(for: access),
            branch: branch(for: access),
        ))
    }

    /// A Session at a given fullness, with every other fact held still — so a PNG of two tiers
    /// differs in the one thing the tier decides, and a PNG of two postures at one reading differs
    /// only in what Argo is allowed to offer.
    static func header(
        context tokens: Int?,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: access,
            title: "Ship the native Liquid Glass application shell",
            branch: "argo/#511-header-context-fullness",
            contextTokens: tokens,
        ))
    }

    /// The external posture is given the branch that does not fit, deliberately. The branch sits
    /// immediately BEFORE the access mark on the line, so a name long enough to eat the width is
    /// exactly what crowds the mark out — and a mark that survives only beside a short name is a
    /// mark drawn for fixtures.
    ///
    /// A `switch`, so a fourth posture has to choose rather than inheriting the short one.
    private static func branch(for access: CockpitPresentation.Session.Access) -> String {
        switch access {
        case .external: longBranchName
        case .managed, .orphaned: "argo/#510-session-header-facts"
        }
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

    /// The external one's title is long enough to be CUT at the narrowest deck, deliberately: the
    /// title has the width to itself now, and what a PNG has to show is that taking all of it
    /// still leaves it cut at the tail rather than wrapping into the line below.
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
