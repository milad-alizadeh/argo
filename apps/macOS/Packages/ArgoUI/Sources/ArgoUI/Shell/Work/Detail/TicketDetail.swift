import SwiftUI

/// The deck's trailing pane: one scrolling column, no inner split. There is no 240pt facts sidebar
/// — at the ideal window this pane is 480, and a second column inside it would leave neither
/// readable (`cockpit-work-room.md`). That is what the room trades for showing list and ticket
/// at once, and why the facts are a strip under the title instead.
struct TicketDetail: View {
    let ticket: WorkRoomProjection.Ticket?
    /// Which ticket the deck is open on. The Children section writes to it, so a parent's child
    /// opens where the reader already is rather than sending them back out to the list.
    @Binding var selection: Int?

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
            VStack(alignment: .leading, spacing: ArgoTicketDetail.headStep) {
                TicketHead(ticket: ticket)
                TicketFactStrip(ticket: ticket)
            }
            TicketBody(ticket: ticket) { selection = $0 }
        }
        .padding(ArgoTicketDetail.inset)
        // The feed's measure, REUSED: the feed already settled what a line of Argo's prose runs to,
        // and a second cap here would be a second answer to one question.
        .argoFeedMeasure()
    }
}

#Preview("Ticket detail") {
    TicketDetail(ticket: WorkFixture.room.ticket, selection: .constant(272))
        .frame(width: ArgoTicketDetail.idealWidth, height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — a parent, deep") {
    TicketDetail(ticket: WorkFixture.room(showing: 607).ticket, selection: .constant(607))
        .frame(width: ArgoTicketDetail.idealWidth, height: 720)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — nothing selected") {
    TicketDetail(ticket: nil, selection: .constant(nil))
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
