import ArgoDesign
import SwiftUI

/// The ticket's head: id, title, then the status pair. Title-FIRST — no scope badge and no
/// produced-by field (#272), because the largest line in the pane should be the thing the pane is
/// about.
package struct TicketHead: View {
    @Environment(\.argo) private var argo

    let ticket: TicketsRoomProjection.Detail

    package var body: some View {
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

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(ticket: TicketsRoomProjection.Detail) {
        self.ticket = ticket
    }
}
