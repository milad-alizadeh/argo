import ArgoUI
import SwiftUI

#Preview("Ticket body — two Deliveries, five children and six blockers") {
    if let ticket = TicketsFixture.room(showing: 607).ticket {
        ScrollView {
            TicketBody(ticket: ticket, open: { _ in })
                .padding(ArgoTicketDetail.inset)
        }
        .frame(width: ArgoTicketDetail.idealWidth, height: 620)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Ticket body — no Delivery, and no edges to draw") {
    if let ticket = TicketsRoomProjection.room(from: TicketsFixture.edgeless).ticket {
        ScrollView {
            TicketBody(ticket: ticket, open: { _ in })
                .padding(ArgoTicketDetail.inset)
        }
        .frame(width: ArgoTicketDetail.idealWidth, height: 420)
        .argoDeckSurface()
        .argoAppearance()
    }
}
