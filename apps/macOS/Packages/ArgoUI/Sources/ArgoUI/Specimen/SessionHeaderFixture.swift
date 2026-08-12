import ArgoEngine

/// The Sessions the header specimens are rendered from — one per access posture, plus the one
/// whose branch does not fit. Headers are projected here exactly as the shell projects them.
enum SessionHeaderFixture {
    /// Every posture's header, in `Access.allCases` order — what the catalog is checked against,
    /// so a posture nothing renders fails a test.
    static let headers = CockpitPresentation.Session.Access.allCases.map(header(for:))

    /// A real branch name off this machine, long enough that the line cannot hold it.
    static let longBranchName = "worktree-ticket-375-graphite-ion-blue"

    /// What the PNG settles is that the cut lands on the BRANCH and that the marks, the model and
    /// the issue after it are all still there.
    static let longBranch = SessionHeaderProjection.header(from: session(
        access: .managed,
        title: "Ship the graphite ion-blue scope vessel",
        branch: longBranchName,
    ))

    /// A Session whose record carried almost nothing: no CLI, a model nobody's table knows, no
    /// git read behind it and no issue. The line has to hold its shape with most of it missing.
    static let sparse = SessionHeaderProjection.header(from: CockpitPresentation.Session(
        id: "header-sparse",
        title: "Watch a Session read off a record that said very little",
        model: "some-unreleased-model",
        workspaceLocation: "/Users/milad/Developer/argo",
        access: .external,
        status: .unknown,
    ))

    /// The one Session the band spends a word on: an agent blocked on a Permission. Drawn beside
    /// the calm postures on purpose — whether the word carries is a question about the headers
    /// around it.
    static let needsInput = SessionHeaderProjection.header(from: session(
        access: .managed,
        title: "Drive a Session from a composer",
        branch: "argo/#535-session-drive-port",
        status: .permission,
    ))

    /// Every shape the fact line takes, for the previews that judge them as a group.
    static let gallery = headers + [longBranch, sparse]

    /// One header per context tier, plus the record that carried no usage at all.
    ///
    /// The numbers are readings off real Sessions rather than round ones: `67.2k` and `216.8k` are
    /// what the instrument actually has to fit. Each carries the name it renders under, so the
    /// registry builds an entry per tier rather than looking one up.
    static let contexts: [(name: String, header: SessionHeaderProjection.Header)] = [
        ("contextOk", header(context: 67175)),
        ("contextWarn", header(context: 216_764)),
        ("contextCrit", header(context: 472_233)),
        ("contextUnknown", header(context: nil)),
    ]

    /// Just the readings, for the preview that judges the four side by side.
    static let contextReadings = contexts.map(\.header.context)

    /// Every state the OFFER has, each carrying the name it renders under. The first is the one
    /// with NOTHING in it; then the same reading on a Session Argo cannot drive — the warning
    /// without the button (story 49).
    static let handoffs: [(name: String, header: SessionHeaderProjection.Header)] = [
        ("handoffWithheld", header(context: 67175)),
        ("handoffAtWarn", header(context: 216_764)),
        ("handoffAtCrit", header(context: 472_233)),
        ("handoffOnReadOnly", header(context: 216_764, access: .external)),
        ("handoffOnOrphaned", header(context: 472_233, access: .orphaned)),
    ]

    /// The remedy already taken, at a reading that stays red. Apart from the offers above because
    /// it is not one: the button is gone and what is left is the link to the Session it went to.
    static let handedOff = header(context: 472_233, handedOffTo: "fresh-session")

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
    /// differs in the one thing the tier decides.
    static func header(
        context tokens: Int?,
        access: CockpitPresentation.Session.Access = .managed,
        handedOffTo: String? = nil,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: access,
            title: "Ship the native Liquid Glass application shell",
            branch: "argo/#511-header-context-fullness",
            contextTokens: tokens,
            handedOffTo: handedOffTo,
        ))
    }

    /// The external posture is given the branch that does not fit, deliberately: the branch sits
    /// immediately BEFORE the access mark on the line, so a long name is what crowds the mark out.
    private static func branch(for access: CockpitPresentation.Session.Access) -> String {
        switch access {
        case .external: longBranchName
        case .managed, .orphaned: "argo/#510-session-header-facts"
        }
    }

    /// The Workspace and the issue are drawn on every posture on purpose: whether a read-only
    /// Session still says what it is working on is exactly what a PNG is for.
    private static func session(
        access: CockpitPresentation.Session.Access,
        title: String,
        branch: String,
        contextTokens: Int? = 216_764,
        handedOffTo: String? = nil,
        status: SessionStatus = .idle,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "header-\(access)",
            title: title,
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: access,
            status: status,
            cli: .claude,
            workspace: .init(kind: .worktree, branch: branch, dirty: 3, unpushed: 1),
            // A link with no title read through it, which is every Session in this build: no
            // provider is connected (#414), so nothing answers with one.
            issue: .init(number: 510),
            contextTokens: contextTokens,
            handedOffTo: handedOffTo,
        )
    }

    /// The external one's title is long enough to be CUT at the narrowest deck, deliberately: what
    /// a PNG has to show is that it is cut at the tail rather than wrapping into the line below.
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
