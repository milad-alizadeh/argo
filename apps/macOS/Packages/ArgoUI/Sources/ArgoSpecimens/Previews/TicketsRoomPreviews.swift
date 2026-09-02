import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Tickets room — the deck's two panes") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var cockpitRoom = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen
    @Previewable @State var width = ArgoBacklogList.width
    @Previewable @State var shut: Set<Int> = []

    TicketsRoom(
        room: TicketsFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket, view: $view,
        backlogWidth: $width, shut: $shut,
    )
    .deck
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}
