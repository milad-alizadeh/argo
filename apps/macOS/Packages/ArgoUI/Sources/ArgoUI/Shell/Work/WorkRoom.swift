import SwiftUI

/// The Work room, as the PAIR of views the shell's split view slots take.
///
/// Not one `View`: `NavigationSplitView` owns its two slots, so a room fills them rather than
/// replacing them — which is what `cockpit-work-room.md` means by "it does not own a split of its
/// own". Both halves read the same `Room` value, so the sidebar's counts and the deck's rows can
/// never be two different answers.
struct WorkRoom {
    let room: WorkRoomProjection.Room
    /// Which room the strip in the sidebar's head is on — the whole window's, not this room's.
    @Binding var cockpitRoom: CockpitRoom
    /// Which ticket the deck is open on. Held above the room, because the ticket outlives the pane.
    @Binding var ticket: Int?

    var sidebar: some View {
        WorkSidebar(room: room, cockpitRoom: $cockpitRoom)
    }

    var deck: some View {
        HStack(spacing: ArgoSpacing.flush) {
            BacklogList(rows: room.backlog, selection: $ticket)
            DeckSeparator()
            TicketDetail(ticket: room.ticket)
        }
    }
}

#Preview("Work room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.work

    WorkRoom(room: WorkFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket)
        .deck
        .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}
