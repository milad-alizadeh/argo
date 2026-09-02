import ArgoUI
import SwiftUI

#Preview("Fact strip — every fact read") {
    if let ticket = TicketsFixture.room.ticket {
        TicketFactStrip(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Fact strip — nothing read but Argo's own bucket") {
    if let ticket = TicketsRoomProjection.room(from: TicketsFixture.unread).ticket {
        TicketFactStrip(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}
