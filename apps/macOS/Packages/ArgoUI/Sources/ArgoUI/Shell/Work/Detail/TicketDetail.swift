import SwiftUI

/// The deck's trailing pane: one scrolling column, no inner split. There is no 240pt facts sidebar
/// — at the ideal window this pane is 480, and a second column inside it would leave neither
/// readable (`cockpit-work-room.md`). That is what the room trades for showing list and ticket
/// at once, and why the facts are a strip under the title instead.
///
/// The pane carries no band of its own: the ticket's verbs are in the window's row with the rest of
/// the room's controls (`WorkToolbar`), which is a line of height back for the words.
struct TicketDetail: View {
    let ticket: WorkRoomProjection.Detail?
    /// What opening a child does — the pane never reads back what it opened, so this is a closure
    /// and not a binding that could disagree with `ticket`.
    let open: (Int) -> Void

    var body: some View {
        ScrollView {
            if let ticket {
                column(for: ticket)
            }
        }
        // A FLOOR of its own, so the list beside it yields first (#836): the body wraps to whatever
        // this pane is left, and `feedMinimumWidth` is the width the feed already settled a column
        // of Argo's prose still reads at.
        .frame(
            minWidth: ArgoLayout.feedMinimumWidth,
            maxWidth: .infinity,
            maxHeight: .infinity,
        )
    }

    private func column(for ticket: WorkRoomProjection.Detail) -> some View {
        // `stripStep` twice over: the strip pads its own hairline off the labels above it, and
        // this spends the same step again under it.
        VStack(alignment: .leading, spacing: ArgoTicketDetail.stripStep) {
            VStack(alignment: .leading, spacing: ArgoTicketDetail.stripLift) {
                TicketHead(ticket: ticket)
                TicketFactStrip(ticket: ticket)
            }
            TicketBody(ticket: ticket, open: open)
        }
        .padding(ArgoTicketDetail.inset)
        // The feed's measure, REUSED: the feed already settled what a line of Argo's prose runs to,
        // and a second cap here would be a second answer to one question.
        .argoFeedMeasure()
    }
}

#Preview("Ticket detail") {
    TicketDetail(ticket: WorkFixture.room.ticket, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — a parent, deep") {
    TicketDetail(ticket: WorkFixture.room(showing: 607).ticket, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 720)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — nothing selected") {
    TicketDetail(ticket: nil, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
