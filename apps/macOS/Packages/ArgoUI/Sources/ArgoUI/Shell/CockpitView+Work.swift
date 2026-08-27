import SwiftUI

/// The shell's room-awareness (#812): which sidebar the split view's leading slot takes, how wide
/// it opens, and where the Work room's value comes from.
extension CockpitView {
    /// The room, assembled once. Both slots ask for it, so neither can be handed a different
    /// projection or a stale selection — the backlog is already filtered to the open view here.
    ///
    /// Fixture-fed, deliberately and only for now: the Work Item port lists (#388) but nothing
    /// projects it onto the Hub, so a room wired to live state would draw an empty one. The
    /// `WorkFixture.reading` below is the single place that changes when the read path lands.
    var workRoom: WorkRoom {
        @Bindable var navigation = navigation

        return WorkRoom(
            room: WorkRoomProjection.room(from: WorkFixture.reading, in: navigation.workView),
            cockpitRoom: $navigation.room,
            ticket: $navigation.ticket,
            view: $navigation.workView,
        )
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

    /// What the room adds to `ShellToolbar`. The `if` reads a `switch`'s answer rather than testing
    /// the room itself: `ToolbarContentBuilder` has no empty content, so the exhaustiveness the
    /// next room needs has to live in `addsAToolbar` below.
    @ToolbarContentBuilder func roomToolbar(navigation: CockpitNavigationModel)
        -> some ToolbarContent {
        @Bindable var navigation = navigation

        if navigation.room.addsAToolbar {
            workRoom.toolbar(
                held: WorkToolbar.Held(
                    query: $navigation.workQuery,
                    mode: $navigation.workMode,
                ),
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

extension CockpitRoom {
    /// Whether this room draws a toolbar row of its own beside `ShellToolbar`'s. Work does; the
    /// other two have nothing to put there yet, and a room added later has to answer here.
    var addsAToolbar: Bool {
        switch self {
        case .work: true
        case .sessions, .code: false
        }
    }
}
