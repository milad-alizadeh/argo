import ArgoEngine
import ArgoUI

/// The Sessions the header specimens are rendered from — one per access posture, plus the one
/// whose branch does not fit. Headers are projected here exactly as the shell projects them.
enum SessionHeaderFixture {
    /// Every posture's header, in `Access.allCases` order — what the catalog is checked against,
    /// so a posture nothing renders fails a test.
    static let headers = CockpitPresentation.Session.Access.allCases.map(header(for:))

    /// A real branch name off this machine, long enough that the line cannot hold it.
    static let longBranchName = "worktree-ticket-375-graphite-ion-blue"

    /// The one Session the band spends a word on: an agent blocked on a Permission. Drawn beside
    /// the calm postures on purpose — whether the word carries is a question about the headers
    /// around it.
    static let needsInput = SessionHeaderProjection.header(from: session(
        access: .managed,
        title: "Drive a Session from a composer",
        branch: "argo/#535-session-drive-port",
        status: .permission,
    ))

    /// One header per context tier, plus the record that carried no usage at all.
    ///
    /// The numbers are readings off real Sessions rather than round ones: `67.2k` and `216.8k` are
    /// what the instrument actually has to fit. Each carries the name it renders under, so the
    /// registry builds an entry per tier rather than looking one up.
    static let contexts: [(name: String, header: SessionHeaderProjection.Header)] = [
        ("contextOk", header(context: .held(67175))),
        ("contextWarn", header(context: .held(216_764))),
        ("contextCrit", header(context: .held(472_233))),
        ("contextUnknown", header(context: .unreadable)),
        // A Session Argo has not heard from yet: the zone is EMPTY, no reading and no meter
        // (#1249).
        ("contextUnread", header(context: .unread)),
    ]

    /// Just the readings, for the preview that judges them side by side. The unread one has none,
    /// which is the whole of what it draws.
    static let contextReadings = contexts.compactMap(\.header.context)

    /// Every state the OFFER has, each carrying the name it renders under. The first is the one
    /// with NOTHING in it; then the same reading on a Session Argo cannot drive — the warning
    /// without the button (story 49).
    static let handoffs: [(name: String, header: SessionHeaderProjection.Header)] = [
        ("handoffWithheld", header(context: .held(67175))),
        ("handoffAtWarn", header(context: .held(216_764))),
        ("handoffAtCrit", header(context: .held(472_233))),
        ("handoffOnReadOnly", header(context: .held(216_764), access: .external)),
        ("handoffOnOrphaned", header(context: .held(472_233), access: .orphaned)),
    ]

    /// The remedy already taken, at a reading that stays red. Apart from the offers above because
    /// it is not one: the button is gone and what is left is the link to the Session it went to.
    static let handedOff = header(context: .held(472_233), handedOffTo: "fresh-session")

    /// The button's own states for the preview that judges the three side by side — amber, red, and
    /// the one that is drawn and out of reach.
    static let handoffOffers: [SessionHeaderProjection.Handoff] = [
        header(context: .held(216_764)).handoff,
        header(context: .held(472_233)).handoff,
        SessionHeaderProjection.handoff(from: CockpitPresentation.Session(
            id: "header-folderless",
            title: "A Session whose folder Argo never read",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(model: "claude-opus-5")),
            spend: .init(context: .held(216_764)),
        )),
    ].compactMap(\.self)

    /// The Session `docs/designs/header/guide.png` is drawn from — the one fixture carrying every
    /// telemetry fact at once, because the ⓘ panel is where they are all said together. Its issue
    /// has a title, unlike the others here, because the panel's longest row is a wrapping one.
    static let guided = SessionHeaderProjection.header(from: CockpitPresentation.Session(
        id: "header-guided",
        title: "Anchor the feed on its newest line",
        access: .managed,
        status: .idle,
        chain: .init(
            program: .init(cli: .claude, model: "claude-opus-5"),
            span: .init(startedAtMs: 0, lastSeenAtMs: 48 * 60000),
        ),
        work: .init(
            // The folder the branch does NOT name, so the checkout reading spends its worktree
            // clause (#1199) — the reading a worktree named after its branch never reaches.
            location: "/Users/milad/Developer/argo/.claude/worktrees/tkt-476",
            workspace: .init(kind: .worktree, branch: "argo/#476-feed-scroll-anchor"),
            ticket: .linked(.init(number: 476, title: "Anchor the feed on its newest line")),
        ),
        spend: .init(spentTokens: 22_470_000, cachedTokens: 20_400_000, context: .held(163_912)),
        transcript: .init(
            // A call a minute for 41 of the 48 minutes: every gap under the away cutoff, so the
            // worked reading is the 41m the render prints beside the 48m it ran.
            events: (0 ... 41).map { minute in
                .toolCall(ToolCall(
                    id: "guided-\(minute)",
                    name: "Read",
                    kind: .read,
                    target: "CONTEXT.md",
                    atMs: minute * 60000,
                ))
            },
        ),
    ))

    /// The same panel over a Session almost nothing was read off — the block collapses to the two
    /// rows Argo has rather than drawing a column of dashes. Its spend is `unreadable` and not
    /// `unread`: the panel opens off the instrument, and a Session with no instrument has no panel
    /// to render (#1249).
    static let unguided = SessionHeaderProjection.header(from: CockpitPresentation.Session(
        id: "header-unguided",
        title: "A Session whose record carried a spend Argo cannot use",
        access: .external,
        status: .idle,
        spend: .init(context: .unreadable),
    ))

    /// A Session on a branch that names no ticket, with a provider bound to have read one (#894).
    /// The Issue row used to VANISH here, which is the one state in the panel a reader can repair.
    static let unlinked = SessionHeaderProjection.header(from: CockpitPresentation.Session(
        id: "header-unlinked",
        title: "Sweep the rules folder",
        access: .managed,
        status: .idle,
        chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
        work: .init(
            // The folder the branch DOES name, which is the common shape on this machine: the
            // checkout reading says it is a worktree and names it no second time (#1199).
            location: "/Users/milad/argo/.claude/worktrees/worktree-parallel-workitem-edges",
            workspace: .init(kind: .worktree, branch: "worktree-parallel-workitem-edges"),
            ticket: .unlinked,
        ),
        spend: .init(context: .held(67175)),
    ))

    /// No Ticket provider bound at all (#1092): the tab line's Issue link and the panel's `Issue`
    /// row both draw nothing, which is `unread`'s own reading and not `unlinked`'s repairable one.
    static let unread = SessionHeaderProjection.header(from: CockpitPresentation.Session(
        id: "header-unread",
        title: "Read the deck's own chrome layout",
        access: .managed,
        status: .idle,
        chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
        work: .init(
            location: "/Users/milad/Developer/argo/.claude/worktrees/tkt-1092",
            workspace: .init(kind: .worktree, branch: "argo/#1092-session-ticket-link"),
            ticket: .unread,
        ),
        spend: .init(context: .held(67175)),
    ))

    /// A backlog to attach the `unlinked` Session above to (#1092) — this repo's own open tickets,
    /// as the picker orders them. What turns that reading's dead-end word into the one gesture that
    /// puts a Session on a Ticket whatever its branch is called.
    ///
    /// Computed, not stored: the offering carries the write that lands a choice, and a closure is
    /// not `Sendable` — so this is a value built per read rather than one shared across tasks.
    static var offering: SessionTicketLinking {
        SessionTicketLinking(options: [
            .init(number: 1092, title: "Route between Session and Ticket"),
            .init(number: 812, title: "The Work room reads the backlog"),
            .init(number: 388, title: "Ticket read path: listing, status, dependency edges"),
        ])
    }

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
        context reading: ContextReading,
        access: CockpitPresentation.Session.Access = .managed,
        handedOffTo: String? = nil,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(
            access: access,
            title: "Ship the native Liquid Glass application shell",
            branch: "argo/#511-header-context-fullness",
            context: reading,
            handedOffTo: handedOffTo,
        ))
    }
}
