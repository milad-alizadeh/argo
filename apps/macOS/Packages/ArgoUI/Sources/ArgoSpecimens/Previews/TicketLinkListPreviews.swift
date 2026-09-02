import ArgoUI
import SwiftUI

#Preview("Link list — children, with the provider's word trailing each") {
    if let children = TicketsFixture.room(showing: 607).ticket?.children {
        TicketLinkList(links: children.open, open: { _ in })
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Link list — six blockers, one of them never read") {
    if let ticket = TicketsFixture.room(showing: 607).ticket {
        TicketLinkList(links: ticket.blockedBy, open: { _ in })
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}
