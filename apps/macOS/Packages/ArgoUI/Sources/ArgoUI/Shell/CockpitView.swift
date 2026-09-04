import ArgoDesign
import ArgoEngine
import SwiftUI

/// The production application shell: native navigation, one opaque deck, and two glass vessels.
///
/// The one place in the shell that reads the navigation model. Everything below it takes values
/// and bindings, so each piece still renders from a `#Preview` or a specimen without one.
/// The non-`private` members below are read by `CockpitView+Intents.swift` and by nothing else.
public struct CockpitView: View {
    /// The size the window opens at, beside the minimum this view already holds it to. Read from
    /// here rather than from the contract directly, so the scene takes its window furniture from
    /// the module that draws the window and the app target names no token of its own (ADR-0022).
    public static let idealSize = CGSize(
        width: ArgoLayout.windowIdealWidth,
        height: ArgoLayout.windowIdealHeight,
    )

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
    /// The archive waiting on an answer, when one is (#1290). Held HERE for the reason the rename
    /// above is: the menu bar raises this gesture as well as the row, and the menu bar is outside
    /// the sidebar — one prompt over both, or the two gestures would need a prompt each.
    @State var archiveConfirmation: ArchiveConfirmation?
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
    /// Where a close or reopen has got to, keyed by the ticket it was raised on (#1333). Per-number
    /// and not one value beside `ticketWrite`: a refusal on the ticket the reader just left must
    /// not surface beside the one they opened next.
    @State var closureWrite: [Int: WriteAttempt] = [:]
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
    /// Every Session the reader has opened this launch, each with its own deck — table, scroll
    /// position and folds — kept off screen while they are elsewhere and shown again unchanged
    /// (ADR-0030, Rule 4). Held HERE for the reason the heights beside it are: this is the one view
    /// above `InstrumentDeckShell`'s room `switch`, which destroys the whole feed zone.
    ///
    /// A tighter bound than the heights: six decks against twenty readings, so a Session pushed out
    /// of the decks still re-opens over geometry nothing has to measure again. See `KeptDecks`.
    @State var feedDecks = KeptDecks()
    /// Which Session the shell has already drawn — what says whether this pass may take a reading
    /// at all. See `DrawnSession`.
    /// The Atlas room's container: it holds the Map store and the reading off it. A container
    /// rather than a projection because the map is a file on this machine that nothing pushes —
    /// see `AtlasRoomModel`.
    @State var atlas = AtlasRoomModel()
    @State private var drawn = DrawnSession()

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
        readings.tickets.items
    }

    var ticketAddress: TicketAddress? {
        readings.ticketAddress
    }

    var closedTickets: TicketLedger.ClosedListing? {
        readings.tickets.closed
    }

    var subagents: FeedAgentReader {
        presentation.subagents
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

    /// The window's chrome, over the rooms or over the one error state that replaces them — a
    /// Project whose folder is not at the recorded path is disabled WHOLE (failure spec §6), so the
    /// branch is above the split view rather than inside a room.
    ///
    /// The three modifiers below belong to the WINDOW and so to both branches; the title and the
    /// bar differ, and each branch states its own.
    public var body: some View {
        Group {
            if let reading = ProjectDisabledReading(presentation: presentation) {
                disabled(reading)
            } else {
                rooms
            }
        }
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
    }

    /// The error state, with the bar narrowed to the Project half — see `ProjectDisabledToolbar`.
    private func disabled(_ reading: ProjectDisabledReading) -> some View {
        ProjectDisabledScreen(
            reading: reading,
            repair: ProjectRepair(projectID: reading.projectID, actions: actions),
        )
        // The Project is still the window's scope, so it is still the window's name: a title that
        // fell back to `Argo` here would read as the Project having gone rather than its folder.
        .navigationTitle(reading.name)
        .toolbar {
            ProjectDisabledToolbar(presentation: presentation, actions: actions)
        }
    }

    /// A `@ViewBuilder` property rather than a `View` of its own: what it draws reads six of this
    /// view's `@State`s, and handing those down is a struct of a dozen bindings that no preview
    /// could build more easily than `CockpitView` already does.
    @ViewBuilder private var rooms: some View {
        @Bindable var navigation = navigation
        // Whether the shell has caught up with the row that was clicked — see `DrawnSession`.
        let isDrawn = drawn.isDrawn(navigation.session)
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
                atlas: atlasRoom,
                // The pass's ONE reading, handed on rather than asked for again (#957) — and only
                // where the shell has caught up with the row that was clicked. See `DrawnSession`.
                reading: isDrawn
                    ? .taken(in: navigation.room, of: presentation, for: navigation.session)
                    : .none,
                isDrawn: isDrawn,
            )
        }
        // The Binding's address, put where the ticket's number can read it (#1242). Set on the
        // split view rather than inside the room: it is a fact about the PROJECT, and the room is
        // rebuilt on every ticket.
        .environment(\.argoTicketAddress, ticketAddress)
        // One event, two causes: arriving in the room, and the active Project changing under it
        // (ADR-0015). `initial: true` because a window that opens onto the Atlas has neither.
        .task(id: atlasSubject) { await openAtlas() }
        .navigationTitle(presentation.activeProject?.name ?? "Argo")
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
        // Archiving a Session Argo owns ends its agent, so an archive that would end live work is
        // asked about first (#1290). On the shell beside the sheets above, and for their reason:
        // both gestures that raise it — the menu bar's item and the roster row's swipe — are
        // outside the deck, and the row's own swipe closes over the prompt it would present.
        .modifier(ArchiveConfirmationDialog(pending: $archiveConfirmation) { sessionID in
            actions.sessions.setArchived(sessionID, true)
        })
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
        // `initial` is for the catch-up alone: the shell can be handed a selection before its
        // first pass — a restored window, and every hosted fixture — and a `DrawnSession` that
        // never heard about it would read inline for the life of the window. The evidence is
        // cleared on a CHANGE, which the initial fire is not: it reports the same id twice.
        .onChange(of: navigation.session, initial: true) { was, pointed in
            if was != pointed {
                forgetEvidence()
            }
            drawn.catchUp(to: pointed, in: navigation)
        }
    }
}
