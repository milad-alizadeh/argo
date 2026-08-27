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
    /// Which view is open. Above the room too, and for a sharper reason: `room.backlog` is already
    /// filtered to it, so the selection has to be settled before the room is derived.
    @Binding var view: WorkView
    /// What the unbound page's `Connect a provider…` does. Inert by default, so a preview and a
    /// specimen draw the button without opening a panel behind the render.
    var connect: @MainActor () -> Void = {}

    var sidebar: some View {
        WorkSidebar(room: room, cockpitRoom: $cockpitRoom, view: $view)
    }

    /// The room's controls, in the window's one toolbar row. A function and not a property, because
    /// the two things the row HOLDS are the window's rather than the room's — see `WorkToolbar` for
    /// why the row settles its columns by claiming the backlog's width.
    func toolbar(held: WorkToolbar.Held) -> WorkToolbar {
        WorkToolbar(
            reading: WorkToolbarProjection.reading(of: room, in: view, showing: ticket),
            held: held,
        )
    }

    /// The two panes, OR one of the room's two vacancies — never both.
    @ViewBuilder var deck: some View {
        if let vacancy = room.vacancy {
            WorkRoomVacancy(vacancy: vacancy, project: room.project, connect: connect)
        } else {
            HStack(spacing: ArgoSpacing.flush) {
                BacklogList(rows: room.backlog, selection: $ticket)
                DeckSeparator()
                TicketDetail(ticket: room.ticket) { ticket = $0 }
            }
        }
    }
}

#Preview("Work room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.work
    @Previewable @State var view = WorkView.allOpen

    WorkRoom(
        room: WorkFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket, view: $view,
    )
    .deck
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}
