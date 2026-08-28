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
    let health: ConnectionHealthReading
    /// The active Project's Tickets as the last poll that finished read them (#820). Beside the
    /// presentation for the same reason `health` is: a listing is read through a Binding, and the
    /// Hub has never heard of one.
    let tickets: [Ticket]
    /// Where this Project's Tickets can be READ, on the provider's own site (#872). Beside the
    /// listing for the reason it is: an address is the Binding's, and the Hub has never heard of
    /// one. `nil` where the port is bound to nothing, which disables the row's two link verbs.
    let ticketAddress: TicketAddress?
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

    public init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
        connect: ConnectSurface = .closed,
        health: ConnectionHealthReading = .quiet,
        tickets: [Ticket] = [],
        ticketAddress: TicketAddress? = nil,
    ) {
        self.presentation = presentation
        self.actions = actions
        self.connect = connect
        self.health = health
        self.tickets = tickets
        self.ticketAddress = ticketAddress
    }

    /// The selected Session's reading in the room that DRAWS a transcript, and nothing at all in
    /// the other two — the projection walks the whole event stream, and `body` runs in every room.
    ///
    /// Gated rather than cached: the presentation is a value the Hub rebuilds as the transcript
    /// grows, and a memoised reading would show it as it stood when the reader last clicked. That
    /// guarantee is what `SessionsRoomReadingTests` holds.
    ///
    /// The gate is a cost that was measured, not assumed (#858). Mounting the deck across rooms so
    /// a switch need not rebuild it means this may not collapse — and an ungated reading cost a
    /// 100-230 ms main-thread stall on every transcript batch in the rooms that draw no transcript,
    /// where a gated one costs nothing at all.
    /// Not `private`: `CockpitView+Detail` draws it and `CockpitView+Evidence` resolves the
    /// evidence toggle against the same rows.
    var reading: SessionsRoomReading {
        guard navigation.room == .sessions else { return .none }
        return SessionsRoomReading(presentation: presentation, sessionID: navigation.session)
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
            detail(tickets: tickets)
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
                control: ticketsIntents.creation.control,
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
