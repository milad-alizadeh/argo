import SwiftUI

/// The shell's room-awareness (#812): which sidebar the split view's leading slot takes, how wide
/// it opens, and where the Work room's value comes from.
extension CockpitView {
    /// The sidebar is the ROOM's, not the app's. Sessions and Code are unchanged; Work replaces the
    /// roster with its views, because a rail of ticket titles was the thing the design rejected.
    @ViewBuilder func sidebar(navigation: CockpitNavigationModel) -> some View {
        @Bindable var navigation = navigation

        switch navigation.room {
        case .work:
            WorkRoom(room: work, cockpitRoom: $navigation.room, ticket: $navigation.ticket).sidebar
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

    /// Fixture-fed, deliberately and only for now: the Work Item port lists (#388) but nothing
    /// projects it onto the Hub, so a room wired to live state would draw an empty one. This is the
    /// single place that changes when the read path lands.
    var work: WorkRoomProjection.Room {
        WorkFixture.room
    }
}
