import SwiftUI

/// The shell's room-awareness (#812, #818): which sidebar the split view's leading slot takes, how
/// wide it opens, whether it opens at all, and where the Tickets room's value comes from.
extension CockpitView {
    /// The room, assembled once. Both slots ask for it, so neither can be handed a different
    /// projection or a stale selection — the backlog is already filtered to the open view here.
    ///
    /// **Read exactly once per body pass, by `body`, and passed down.** It is a whole projection
    /// over the poll's listing — the tree, the views' counts, the open ticket and the hero's
    /// ranking — and four callers each reading this property ran all of that four times on every
    /// pass, which is what the room switch was waiting for.
    ///
    /// Read from the provider (#820): the poll's own listing, the roster that says which of it is
    /// claimed, and the Ticket Binding's health behind the foot. Nothing here is a fixture, and
    /// nothing missing from the read is filled in — the room degrades to the quieter page instead.
    var ticketsRoom: TicketsRoom {
        @Bindable var navigation = navigation
        let reading = TicketsReading.live(
            TicketsReading.Sources(
                items: tickets,
                sessions: presentation.sessions,
                health: health,
                project: presentation.activeProject?.name,
            ),
            showing: navigation.ticket,
        )

        // Assembled once and shared by the room's two Start controls, so the toolbar's Start and
        // the hero's can never resolve one ticket to two commands.
        let start = ticketStart

        return TicketsRoom(
            room: TicketsRoomProjection.room(
                from: reading, in: navigation.ticketsView, matching: navigation.ticketsQuery,
            ),
            cockpitRoom: $navigation.room,
            ticket: $navigation.ticket,
            view: $navigation.ticketsView,
            backlogWidth: $navigation.backlogWidth,
            shut: $navigation.shutParents,
            connect: openProjectPanel,
            intents: ticketsIntents(start),
            starting: StartIntent(
                run: { ticket in Task { await start.run(on: ticket, in: navigation) } },
                command: { start.command(on: $0) },
            ),
            follow: { await actions.tickets.readTicket($0) },
            held: TicketsRoom.Held(query: $navigation.ticketsQuery),
        )
    }

    /// What the room's controls do (#872). New ticket is `createTicket`, so §7 of the failure
    /// spec decides whether it may be pressed, and the panel it points at on a dead token is the
    /// same one the unbound page's `Connect a provider…` opens.
    ///
    /// `grouping` stays inert, deliberately: `BacklogMenu` states the one grouping in force rather
    /// than offering a choice nothing can answer, and it becomes a menu when a port reads a second
    /// thing to group by (#388). It is the ONLY one — every other slot on the intents is assigned
    /// here, and `BacklogControlsTests` fails if a slot is added and this method does not grow a
    /// line for it. That is what the funnel's `narrowing` never had (#900).
    func ticketsIntents(_ start: TicketStart) -> TicketsToolbarIntents {
        var intents = TicketsToolbarIntents.inert
        intents.creation.control = ticketWriteControl
        intents.creation.act = { openTicketComposer() }
        intents.creation.reconnect = openProjectPanel
        intents.verbs = ticketsVerbs(start)
        return intents
    }

    /// What the New ticket control renders — read by the row's own button AND by the composer's, so
    /// one write can never be drawn two ways (§4).
    var ticketWriteControl: WriteControlState {
        .over(health.writes(through: .ticket), attempt: ticketWrite)
    }

    /// The Connect panel on the active Project, which is where both of the room's repairs land.
    var openProjectPanel: @MainActor () -> Void {
        { actions.openProjectPanel(presentation.activeProjectID) }
    }

    /// The Tickets room with nothing bound hides its half of the split view WHOLE (#818). Hidden
    /// here and not by an empty sidebar view: a `NavigationSplitView` draws its column, its divider
    /// and its toggle around an `EmptyView` all the same.
    ///
    /// The room is still reachable — Rooms is the sidebar's strip, not the rail that just went.
    /// This is where a machine with no Ticket Binding lands, which is every machine before
    /// onboarding and every Project bound to nothing after it.
    ///
    /// Takes the room already assembled rather than reading `ticketsRoom` again — see the note
    /// there. `nil` is every other room, where nothing hides anything.
    func roomHidesSidebar(_ tickets: TicketsRoom?) -> Bool {
        tickets?.room.vacancy == .unbound
    }

    /// The column the split view opens with — the room's answer where it has one, and the reader's
    /// own otherwise. The setter always writes the reader's, so a rail they closed in one room is
    /// still closed after a room that hid it.
    func sidebarColumn(for tickets: TicketsRoom?) -> Binding<NavigationSplitViewVisibility> {
        let reader = $sidebarVisibility
        guard roomHidesSidebar(tickets) else { return reader }
        return Binding(get: { .detailOnly }, set: { reader.wrappedValue = $0 })
    }

    /// The sidebar is the ROOM's, not the app's. Sessions and Code are unchanged; Work replaces the
    /// roster with its views, because a rail of ticket titles was the thing the design rejected.
    @ViewBuilder func sidebar(tickets: TicketsRoom?) -> some View {
        @Bindable var navigation = navigation

        if let tickets {
            tickets.sidebar
        } else {
            ShellSidebar(
                presentation: presentation,
                selection: $navigation.session,
                room: $navigation.room,
                archive: actions.setSessionArchived,
                rename: actions.setSessionName,
                renamingSessionID: $renamingSessionID,
            )
        }
    }

    /// New Session, in the rooms that make one — `nil` in Work, where the compose mark is the
    /// ticket's (#836). Assembled here and not in the toolbar builder: a ternary inside
    /// `ToolbarContentBuilder` is an expression the type-checker gives up on.
    func spawn(in navigation: CockpitNavigationModel) -> CockpitSpawn? {
        guard navigation.room.spawnsSessions else { return nil }
        return CockpitSpawn(presentation: presentation, actions: actions, navigation: navigation)
    }

    /// What the room adds to `ShellToolbar` — the Tickets room's whole row of controls, and nothing
    /// in the other two. `ToolbarContentBuilder` has no empty content, so the absence is an `if`
    /// over the room the caller already assembled rather than a `switch` arm returning nothing.
    @ToolbarContentBuilder func roomToolbar(tickets: TicketsRoom?) -> some ToolbarContent {
        if let tickets {
            tickets.toolbar
        }
    }

    /// Room-dependent, and the one shell change `cockpit-work-room.md` asks for: at the 320 ideal
    /// the backlog beside it drops to 480 and three of twelve titles truncate. No token moves —
    /// Work opens at the MINIMUM the contract already names, and the reader may still drag either
    /// way.
    var sidebarIdealWidth: CGFloat {
        switch navigation.room {
        case .tickets: ArgoLayout.sidebarMinimumWidth
        case .sessions, .code: ArgoLayout.sidebarIdealWidth
        }
    }
}

extension CockpitRoom {
    /// Whether the bar spends its one compose verb on New Session here (#836). Work does not: the
    /// thing that room creates is a ticket, and its own row already carries the compose mark for
    /// it. `⌘N` and the menu bar are unaffected in every room.
    var spawnsSessions: Bool {
        switch self {
        case .sessions, .code: true
        case .tickets: false
        }
    }
}
