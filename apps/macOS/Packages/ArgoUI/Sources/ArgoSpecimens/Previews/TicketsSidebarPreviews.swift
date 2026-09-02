import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Tickets sidebar") {
    @Previewable @State var room = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen

    TicketsSidebar(room: TicketsFixture.room, cockpitRoom: $room, view: $view)
        .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
        .argoAppearance()
}

#Preview("Tickets sidebar — nothing bound") {
    @Previewable @State var room = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen

    TicketsSidebar(
        room: TicketsRoomProjection.room(from: TicketsFixture.unbound),
        cockpitRoom: $room,
        view: $view,
    )
    .frame(width: ArgoLayout.sidebarMinimumWidth, height: 520)
    .argoAppearance()
}
