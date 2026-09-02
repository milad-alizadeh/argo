import ArgoUI
import SwiftUI

#Preview("Ticket head") {
    if let ticket = TicketsFixture.room.ticket {
        TicketHead(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth, alignment: .leading)
            .argoDeckSurface()
            .argoAppearance()
    }
}
