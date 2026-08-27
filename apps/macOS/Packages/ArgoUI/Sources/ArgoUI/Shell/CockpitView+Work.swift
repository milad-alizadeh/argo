import SwiftUI

/// The shell's room-awareness (#812, #818): which sidebar the split view's leading slot takes, how
/// wide it opens, whether it opens at all, and where the Work room's value comes from.
extension CockpitView {
    /// The room, assembled once. Both slots ask for it, so neither can be handed a different
    /// projection or a stale selection — the backlog is already filtered to the open view here.
    ///
    /// Fixture-fed, deliberately and only for now: the Work Item port lists (#388) but nothing
    /// projects it onto the Hub, so a room wired to live state would draw an empty one. The
    /// `WorkFixture.reading` below is the single place that changes when the read path lands.
    var workRoom: WorkRoom {
        @Bindable var navigation = navigation
        let reading = WorkFixture.reading(in: presentation.activeProject?.name)

        return WorkRoom(
            room: WorkRoomProjection.room(from: reading, in: navigation.workView),
            cockpitRoom: $navigation.room,
            ticket: $navigation.ticket,
            view: $navigation.workView,
            shut: $navigation.shutParents,
            connect: { actions.openProjectPanel(presentation.activeProjectID) },
        )
    }

    /// The Work room with nothing bound hides WHOLE, which includes its half of the split view
    /// (#818). Hidden here and not by an empty sidebar view: a `NavigationSplitView` draws its
    /// column, its divider and its toggle around an `EmptyView` all the same.
    ///
    /// The room is still reachable — Rooms is in the toolbar, not in the rail that just went. The
    /// fixture above is always bound, so today only the specimen reaches this.
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
                archive: actions.setSessionArchived,
                rename: actions.setSessionName,
                renamingSessionID: $renamingSessionID,
            )
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
