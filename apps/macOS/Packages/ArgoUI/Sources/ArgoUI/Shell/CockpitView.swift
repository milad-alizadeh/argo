import ArgoEngine
import SwiftUI

/// The production application shell: native navigation, one opaque deck, and two glass vessels.
///
/// The one place in the shell that reads the navigation model. Everything below it takes values
/// and bindings, so each piece still renders from a `#Preview` or a specimen without one.
/// The non-`private` members below are read by `CockpitView+Intents.swift` and by nothing else.
public struct CockpitView: View {
    let presentation: CockpitPresentation
    let actions: CockpitActions
    /// The Connect panel, when it is up. Closed by default so every preview and specimen of the
    /// shell renders the shell rather than a sheet nobody asked for.
    private let connect: ConnectSurface
    /// How the active Project's provider Bindings are reading. Beside the presentation rather than
    /// inside it because it is not a Hub fact: the cockpit is a projection of the Hub, and Accounts
    /// and Bindings are registry facts the Hub has never heard of.
    private let health: ConnectionHealthReading
    @Environment(CockpitNavigationModel.self) var navigation
    /// Which roster row has its name field open. Held here rather than in the sidebar because the
    /// menu bar reaches it (`sessionCommands`), and the menu bar is outside the sidebar.
    @State var renamingSessionID: String?
    /// Every Session's unsent words. Held at the top of the shell because that is the one place
    /// above the deck's per-Session identity: the deck is rebuilt whole on a switch, so a draft
    /// kept any lower would leave with the selection rather than be waiting on the way back (#539).
    @State var drafts = ComposerDrafts()

    public init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
        connect: ConnectSurface = .closed,
        health: ConnectionHealthReading = .quiet,
    ) {
        self.presentation = presentation
        self.actions = actions
        self.connect = connect
        self.health = health
    }

    /// The selected Session's reading. Recomputed on every update rather than cached: the
    /// presentation is a value the Hub rebuilds as the transcript grows, so a memoised feed would
    /// show the reading as it was when the user last clicked.
    private var feed: [FeedRow] {
        FeedProjection.rows(
            from: events,
            working: FeedWorking.isWorking(presentation.session(navigation.session)),
            handedOff: presentation.handoff(of: navigation.session),
            expired: presentation.session(navigation.session)?.expiredPermissions ?? [],
            asking: askingNow,
        )
    }

    /// What the feed's ask rows are told about answering: the question Argo is holding open, and
    /// whether this Session can be driven at all (#546).
    var askingNow: FeedAskProjection.Asking {
        FeedAskProjection.asking(for: presentation.session(navigation.session))
    }

    /// The same Session's plan, off the same stream — the standing state a whole transcript
    /// resolves to, not a row in it.
    private var showing: PlanShowing {
        PlanShowing(plan: PlanProjection.reading(from: events))
    }

    /// What the deck's top zone names.
    private var header: SessionHeaderProjection.Header? {
        presentation.session(navigation.session).map(SessionHeaderProjection.header(from:))
    }

    private var events: [TranscriptEvent] {
        presentation.session(navigation.session)?.events ?? []
    }

    /// The same Session's Subagents, each already read. Recomputed with the feed above and for its
    /// reason: a fan-out's files grow while the reader is looking at one of them.
    private var readings: FeedAgentReadings {
        FeedAgentReadings(events: presentation.session(navigation.session)?.subagentEvents ?? [:])
    }

    /// What is in the deck's one slot for the selected Session — the composer, the Permission
    /// displacing it, the line saying there is nothing to steer, or nothing at all. One decision,
    /// made in `DeckVessel` where a test can reach it.
    var vessel: DeckVessel {
        DeckVessel.resolve(
            for: presentation.session(navigation.session),
            can: capabilities,
        )
    }

    /// What the selected Session's adapter declares, read as one value off the port (#761). With no
    /// Session selected there is nothing to ask about and nothing to draw: `DeckVessel` gives that
    /// case no composer at all, so the defaults below are never rendered.
    private var capabilities: SessionComposerProjection.Capabilities {
        guard let sessionID = navigation.session else { return .init() }
        let surface = actions.drive.surface(of: sessionID)
        return SessionComposerProjection.Capabilities(
            canAttach: surface.takesAttachments,
            canRunCommands: surface.runsCommands,
            resolvesMentions: surface.resolvesMentions,
        )
    }

    /// The sheet is up exactly while there is a reading. Dismissing it — Escape, or the system's
    /// own gesture — runs the same intent the button does, so the panel has one way to close and
    /// the app is never left holding a panel the window has already put away.
    private var isConnecting: Binding<Bool> {
        Binding(
            get: { connect.reading != nil },
            set: { isOpen in
                guard !isOpen else { return }
                connect.actions.finish()
            },
        )
    }

    public var body: some View {
        @Bindable var navigation = navigation

        NavigationSplitView {
            sidebar(navigation: navigation)
                .navigationSplitViewColumnWidth(
                    min: ArgoLayout.sidebarMinimumWidth,
                    ideal: sidebarIdealWidth,
                    max: ArgoLayout.sidebarMaximumWidth,
                )
        } detail: {
            // Resolved once and handed to both: reading it a second time re-runs the selection
            // lookup and every projection behind it.
            let vessel = vessel

            InstrumentDeckShell(
                room: navigation.room,
                session: navigation.session,
                feed: feed,
                header: header,
                handOff: handOff,
                showing: showing,
                vessel: vessel,
                intents: intents(for: vessel),
                readings: readings,
                work: navigation.room == .work ? workRoom : nil,
            )
            // What the chain link at the foot of a handed-off reading does. Injected here because
            // this is the one view that holds the navigation.
            .environment(\.argoOpenSession) { fresh in navigation.session = fresh }
            // What a waiting ask row's options and its `Answer` do (#712). Injected here for the
            // reason above: the rows are hosted per table cell, and this is where the Session the
            // answer addresses is known.
            .environment(\.feedAskAnswering, answer(on: askingNow.live))
            .overlay(alignment: .topLeading) {
                ConnectionChips(
                    connection: presentation.connection,
                    projectID: presentation.activeProjectID,
                    health: health,
                    actions: actions,
                )
                .padding(ArgoSpacing.section)
            }
            // On the DETAIL pane, not on the split view. A split view divides the bar into a
            // region per column, and a flexible spacer only expands inside its own — declared
            // on the split view it landed in a region that spans nothing, which left Rooms
            // parked beside the scope vessel instead of at the trailing edge.
            .toolbar {
                ShellToolbar(
                    room: $navigation.room,
                    scope: ScopeVessel(presentation: presentation, actions: actions),
                    spawn: CockpitSpawn(
                        presentation: presentation,
                        actions: actions,
                        navigation: navigation,
                    ),
                )
            }
        }
        .navigationTitle(presentation.activeProject?.name ?? "Argo")
        // Hidden, so the icons sit on the window's own ground — and the canopy directly below is
        // washed to that same ground. Letting the system draw its titlebar material here instead
        // put the two bands a tone apart, which is the seam through the middle of what has to read
        // as ONE bar. Two rendering paths cannot be matched by eye; one ground can.
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        .frame(
            minWidth: ArgoLayout.windowMinimumWidth,
            minHeight: ArgoLayout.windowMinimumHeight,
        )
        .argoAppearance()
        .sheet(isPresented: isConnecting) {
            if let reading = connect.reading {
                ConnectSheet(
                    reading: reading,
                    actions: connect.actions,
                    startsAtWelcome: connect.startsAtWelcome,
                )
            }
        }
        .focusedValue(\.sessionCommands, sessionCommands)
        .onChange(of: presentation.sessions.map(\.id), initial: true) { _, sessionIDs in
            navigation.reconcile(against: sessionIDs)
        }
        .onChange(of: navigation.chosenSession) { _, pick in
            resumeIfSelectionIsDead(pick)
        }
    }
}

#Preview("Production shell — Session selected") {
    @Previewable @State var navigation = CockpitNavigationModel()

    CockpitView(
        presentation: .preview,
        actions: .inert,
    )
    .environment(navigation)
    .frame(width: 1280, height: 800)
}

#Preview("Production shell — no Sessions") {
    @Previewable @State var navigation = CockpitNavigationModel()

    CockpitView(
        presentation: .emptyPreview,
        actions: .inert,
    )
    .environment(navigation)
    .frame(width: 1080, height: 680)
}
