import ArgoUI
import SwiftUI

#Preview("Ticket detail") {
    TicketDetail(ticket: TicketsFixture.room.ticket, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — a parent, deep") {
    TicketDetail(ticket: TicketsFixture.room(showing: 607).ticket, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 720)
        .argoDeckSurface()
        .argoAppearance()
}
