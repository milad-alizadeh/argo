import SwiftUI

/// The deck's trailing pane: one scrolling column, no inner split. There is no 240pt facts sidebar
/// — at the ideal window this pane is 480, and a second column inside it would leave neither
/// readable (`cockpit-work-room.md`). That is what the room trades for showing list and ticket
/// at once.
struct TicketDetail: View {
    @Environment(\.argo) private var argo

    let ticket: WorkRoomProjection.Ticket?

    var body: some View {
        ScrollView {
            if let ticket {
                column(for: ticket)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func column(for ticket: WorkRoomProjection.Ticket) -> some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.bodyStep) {
            TicketHead(ticket: ticket)
            body(of: ticket)
        }
        .padding(ArgoTicketDetail.inset)
        // The feed's measure, REUSED: the feed already settled what a line of Argo's prose runs to,
        // and a second cap here would be a second answer to one question.
        .argoFeedMeasure()
    }

    /// Set at the feed's own line height, so a paragraph here and a paragraph in a reading are the
    /// same rhythm — the two are read minutes apart in the same window.
    @ViewBuilder private func body(of ticket: WorkRoomProjection.Ticket) -> some View {
        if let prose = ticket.body {
            Text(prose)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .lineSpacing(ArgoFeedRow.proseLineSpacing)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

#Preview("Ticket detail") {
    TicketDetail(ticket: WorkFixture.room.ticket)
        .frame(width: ArgoTicketDetail.idealWidth, height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — nothing selected") {
    TicketDetail(ticket: nil)
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
