import SwiftUI

/// The ticket's head: id, title, then the status pair. Title-FIRST — no scope badge and no
/// produced-by field (#272), because the largest line in the pane should be the thing the pane is
/// about.
struct TicketHead: View {
    @Environment(\.argo) private var argo

    let ticket: WorkRoomProjection.Detail

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.headStep) {
            Text("#\(ticket.id)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(ticket.title)
                .argoText(ArgoTypography.sessionTitle)
                .fixedSize(horizontal: false, vertical: true)
            StatusPair(word: ticket.status, bucket: ticket.bucket)
        }
    }
}

#Preview("Ticket head") {
    if let ticket = WorkFixture.room.ticket {
        TicketHead(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth, alignment: .leading)
            .argoDeckSurface()
            .argoAppearance()
    }
}
