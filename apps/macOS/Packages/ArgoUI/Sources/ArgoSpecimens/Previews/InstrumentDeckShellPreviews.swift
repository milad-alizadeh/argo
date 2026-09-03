import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Instrument Deck — Sessions") {
    InstrumentDeckShell(
        room: .sessions,
        feed: FeedProjection.previewRows,
        header: SessionHeaderFixture.header(for: .managed),
        showing: PlanShowing(plan: PlanProjection.previewReading),
    )
    .frame(width: 900, height: 620)
    .argoAppearance()
}

#Preview("Instrument Deck — the Tickets room") {
    @Previewable @State var ticket: Int? = 272
    @Previewable @State var session: CockpitPresentation.Session.ID?
    @Previewable @State var cockpitRoom = CockpitRoom.tickets
    @Previewable @State var view = TicketsView.allOpen
    @Previewable @State var width = ArgoBacklogList.width
    @Previewable @State var shut: Set<Int> = []

    InstrumentDeckShell(
        room: .tickets,
        tickets: TicketsRoom(
            room: TicketsFixture.room, cockpitRoom: $cockpitRoom, ticket: $ticket,
            session: $session, view: $view, backlogWidth: $width, shut: $shut,
        ),
    )
    .frame(width: ArgoBacklogList.width + ArgoTicketDetail.idealWidth, height: 620)
    .argoAppearance()
}
