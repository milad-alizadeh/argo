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
    /// Everything the shell draws that the projection does not carry — see `ShellReadings`. Four
    /// facts under one name: three the Hub never heard of, and the one it holds that is asked for
    /// rather than carried.
    let readings: ShellReadings

    @Environment(CockpitNavigationModel.self) var navigation
    @Environment(\.openURL) var openURL
    /// Which roster row has its name field open. Held here rather than in the sidebar because the
    /// menu bar reaches it (`sessionCommands`), and the menu bar is outside the sidebar.
    @State var renamingSessionID: String?
    /// Every Session's unsent words. Held at the top of the shell because that is the one place
    /// above the deck's per-Session identity: the deck is rebuilt whole on a switch, so a draft
    /// kept any lower would leave with the selection rather than be waiting on the way back (#539).
    @State var drafts = ComposerDrafts()
    /// Where the reader left the split view's leading column. Held rather than left to the platform
    /// because one room takes it away: see `sidebarColumn`.
    @State var sidebarVisibility = NavigationSplitViewVisibility.automatic
    /// Whether the New ticket composer is up, and what has been typed into it (#872). Held at the
    /// top of the shell for the reason the drafts above are: the room below is rebuilt on every
    /// pass, and words held any lower would leave with the first one that changed anything.
    @State var isComposingTicket = false
    @State var ticketComposition = TicketComposition()
    /// Where the create it raised has got to (§4). Beside the composer rather than inside it: the
    /// row's own button renders the same reading, and two answers about one write would let the
    /// sheet and the row disagree.
    @State var ticketWrite = WriteAttempt.idle
    /// Which call's evidence the panel is showing, and which result inside it. Held HERE rather
    /// than in the deck since #875: the toolbar's toggle reaches them and the toolbar is outside
    /// the deck. See `CockpitView+Evidence`.
    @State var openEvidence: FeedRow.ID?
    @State var evidenceStep: Int?
    /// Which Agent the feed is scoped to. Beside the two above, and for their reason: what the
    /// toggle opens on is the newest evidence in the rows this names.
    @State var feedScope = FeedScope.session
    /// Every recently-read Session's measured row heights, one store per reading. Held HERE because
    /// this is the one view above `InstrumentDeckShell`'s room `switch`, which destroys the feed's
    /// table whole — the heights are the same measurement on the way back, and are only dropped by
    /// what actually changes one: a width or a re-ink. Per reading and not one store shared, or the
    /// Session looked at last overwrites the one the reader is coming back to. See `FeedGeometries`
    /// (#858).
    @State var feedGeometries = FeedGeometries()

    public init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
        connect: ConnectSurface = .closed,
        readings: ShellReadings = .none,
    ) {
        self.presentation = presentation
        self.actions = actions
        self.connect = connect
        self.readings = readings
    }

    /// The three read by name below and in the extensions, so grouping them at the seam did not
    /// spell `readings.` through the shell.
    var health: ConnectionHealthReading {
        readings.health
    }

    var tickets: [Ticket] {
        readings.tickets
    }

    var ticketAddress: TicketAddress? {
        readings.ticketAddress
    }

    var subagents: FeedAgentReader {
        presentation.subagents
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

    /// The whole window, or the one error state that replaces it. A Project whose folder is not at
    /// the recorded path is disabled WHOLE (failure spec §6), so the branch is here rather than
    /// inside a room: there is no half of this window that could be honestly lit.
    ///
    /// The toolbar stays, because it is the way to another Project — a reader trapped on the error
    /// state of one Project could not switch to a Project that is fine.
    public var body: some View {
        if let reading = ProjectDisabledReading(presentation: presentation) {
            ProjectDisabledScreen(
                reading: reading,
                repair: ProjectRepair(projectID: reading.projectID, actions: actions),
            )
            .frame(
                minWidth: ArgoLayout.windowMinimumWidth,
                minHeight: ArgoLayout.windowMinimumHeight,
            )
            .argoAppearance()
            .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
            .toolbar {
                // Scope alone: New Session is refused in a folder that is not there, and there is
                // no room open for an evidence panel to belong to.
                ShellToolbar(
                    scope: ScopeVessel(presentation: presentation, actions: actions),
                    spawn: nil,
                )
            }
        } else {
            rooms
        }
    }

    @ViewBuilder private var rooms: some View {
        @Bindable var navigation = navigation
        // Assembled ONCE for the whole pass and handed to all four readers — the column's
        // visibility, the sidebar, the toolbar row and the deck. `nil` outside the Tickets room,
        // which is also what keeps the projection from running at all in the other two.
        let tickets = navigation.room == .tickets ? ticketsRoom : nil

        NavigationSplitView(columnVisibility: sidebarColumn(for: tickets)) {
            sidebar(tickets: tickets)
                .navigationSplitViewColumnWidth(
                    min: ArgoLayout.sidebarMinimumWidth,
                    ideal: sidebarIdealWidth,
                    max: ArgoLayout.sidebarMaximumWidth,
                )
        } detail: {
            detail(
                tickets: tickets,
                // The pass's ONE reading, handed on rather than asked for again (#957).
                reading: .taken(in: navigation.room, of: presentation, for: navigation.session),
            )
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
        // The Tickets room's own sheet (#872). On the shell rather than in the room, because the
        // room is a pair of split-view slots and neither of them may present over the other.
        // `onDismiss` and not the Cancel button alone: Escape and the system's own gesture put the
        // sheet away without pressing anything, and a refusal left behind would go on being drawn
        // by the row's New ticket button with nothing on screen to clear it.
        .sheet(isPresented: $isComposingTicket, onDismiss: closeTicketComposer) {
            NewTicketComposer(
                composition: $ticketComposition,
                control: ticketWriteControl,
                reconnect: openProjectPanel,
                cancel: closeTicketComposer,
                create: createTicket,
            )
        }
        .focusedValue(\.sessionCommands, sessionCommands)
        .onChange(of: presentation.sessions.map(\.id), initial: true) { _, sessionIDs in
            navigation.reconcile(against: sessionIDs)
        }
        .onChange(of: navigation.chosenSession) { _, pick in
            resumeIfSelectionIsDead(pick)
        }
        // A window is scoped to one Project, and the backlog's query is a question about that
        // Project's tickets — see `projectSwitched()` (#873).
        .onChange(of: presentation.activeProjectID) { _, _ in
            navigation.projectSwitched()
        }
        // What the deck's `.id(session)` used to discard for free — see `forgetEvidence()`.
        .onChange(of: navigation.session) { _, _ in
            forgetEvidence()
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
