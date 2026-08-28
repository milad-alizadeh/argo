import SwiftUI

/// The shell's room-awareness (#812, #818): which sidebar the split view's leading slot takes, how
/// wide it opens, whether it opens at all, and where the Work room's value comes from.
extension CockpitView {
    /// The room, assembled once. Both slots ask for it, so neither can be handed a different
    /// projection or a stale selection — the backlog is already filtered to the open view here.
    ///
    /// Read from the provider (#820): the poll's own listing, the roster that says which of it is
    /// claimed, and the Work Item Binding's health behind the foot. Nothing here is a fixture, and
    /// nothing missing from the read is filled in — the room degrades to the quieter page instead.
    var workRoom: WorkRoom {
        @Bindable var navigation = navigation
        let reading = WorkReading.live(
            WorkReading.Sources(
                items: workItems,
                sessions: presentation.sessions,
                health: health,
                project: presentation.activeProject?.name,
            ),
            showing: navigation.ticket,
        )

        return WorkRoom(
            room: WorkRoomProjection.room(from: reading, in: navigation.workView),
            cockpitRoom: $navigation.room,
            ticket: $navigation.ticket,
            view: $navigation.workView,
            backlogWidth: $navigation.backlogWidth,
            shut: $navigation.shutParents,
            connect: { actions.openProjectPanel(presentation.activeProjectID) },
            held: WorkRoom.Held(query: $navigation.workQuery, mode: $navigation.workMode),
        )
    }

    /// The Work room with nothing bound hides WHOLE, which includes its half of the split view
    /// (#818). Hidden here and not by an empty sidebar view: a `NavigationSplitView` draws its
    /// column, its divider and its toggle around an `EmptyView` all the same.
    ///
    /// The room is still reachable — Rooms is in the toolbar, not in the rail that just went. This
    /// is where a machine with no Work Item Binding lands, which is every machine before onboarding
    /// and every Project bound to nothing after it.
    var roomHidesSidebar: Bool {
        navigation.room == .work && workRoom.room.vacancy == .unbound
    }

    /// The column the split view opens with — the room's answer where it has one, and the reader's
    /// own otherwise. The setter always writes the reader's, so a rail they closed in one room is
    /// still closed after a room that hid it.
    var sidebarColumn: Binding<NavigationSplitViewVisibility> {
        let reader = $sidebarVisibility
        guard roomHidesSidebar else { return reader }
        return Binding(get: { .detailOnly }, set: { reader.wrappedValue = $0 })
    }

    /// The sidebar is the ROOM's, not the app's. Sessions and Code are unchanged; Work replaces the
    /// roster with its views, because a rail of ticket titles was the thing the design rejected.
    @ViewBuilder func sidebar(navigation: CockpitNavigationModel) -> some View {
        @Bindable var navigation = navigation

        switch navigation.room {
        case .work:
            workRoom.sidebar
        case .sessions, .code:
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

    /// What the room adds to `ShellToolbar`. The `if` reads a `switch`'s answer rather than testing
    /// the room itself: `ToolbarContentBuilder` has no empty content, so the exhaustiveness the
    /// next room needs has to live in `addsAToolbar` below.
    @ToolbarContentBuilder func roomToolbar(navigation: CockpitNavigationModel)
        -> some ToolbarContent {
        @Bindable var navigation = navigation

        if navigation.room.addsAToolbar {
            workRoom.toolbar
        }
    }

    /// Room-dependent, and the one shell change `cockpit-work-room.md` asks for: at the 320 ideal
    /// the backlog beside it drops to 480 and three of twelve titles truncate. No token moves —
    /// Work opens at the MINIMUM the contract already names, and the reader may still drag either
    /// way.
    var sidebarIdealWidth: CGFloat {
        switch navigation.room {
        case .work: ArgoLayout.sidebarMinimumWidth
        case .sessions, .code: ArgoLayout.sidebarIdealWidth
        }
    }
}

extension CockpitRoom {
    /// Whether this room draws a toolbar row of its own beside `ShellToolbar`'s. Work does; the
    /// other two have nothing to put there yet, and a room added later has to answer here.
    var addsAToolbar: Bool {
        switch self {
        case .work: true
        case .sessions, .code: false
        }
    }

    /// Whether the bar spends its one compose verb on New Session here (#836). Work does not: the
    /// thing that room creates is a ticket, and its own row already carries the compose mark for
    /// it. `⌘N` and the menu bar are unaffected in every room.
    var spawnsSessions: Bool {
        switch self {
        case .sessions, .code: true
        case .work: false
        }
    }
}
