import ArgoDesign
import ArgoEngine
import SwiftUI

/// The deck's trailing pane: one scrolling column, no inner split. There is no 240pt facts sidebar
/// — at the ideal window this pane is 480, and a second column inside it would leave neither
/// readable (`cockpit-work-room.md`). That is what the room trades for showing list and ticket
/// at once, and why the facts are a strip under the title instead.
///
/// The pane's verbs are on its OWN header band (`TicketsPaneHeader`, #1242), which is what puts
/// them over the ticket they act on at every width. The band is drawn in the window's title strip
/// rather than under it, so this column loses no line to it.
package struct TicketDetail: View {
    let ticket: TicketsRoomProjection.Detail?
    /// The number the pane is open on that nothing was read for, and `nil` wherever `ticket` has
    /// something — the projection settles which of the two this is (`TicketsRoomProjection.Room`).
    var unreadNumber: Int?
    /// What opening a child or a blocker does — the pane never reads back what it opened, so this
    /// is a closure and not a binding that could disagree with `ticket`.
    let open: (Int) -> Void
    /// What pressing the head's claimant line does — a different room, so this is its own closure
    /// rather than `open` above, which stays inside this one (#1092).
    var openSession: (CockpitPresentation.Session.ID) -> Void = { _ in }

    package var body: some View {
        // Only the ticket SCROLLS. A one-line sentence in a scroll view sits at the top of it,
        // which is the wrong shape for a stated empty — `BacklogNoMatch` centres in the pane.
        Group {
            if let ticket {
                ScrollView { column(for: ticket) }
            } else if let unreadNumber {
                TicketUnread(number: unreadNumber)
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

    private func column(for ticket: TicketsRoomProjection.Detail) -> some View {
        // `stripStep` twice over: the strip pads its own hairline off the labels above it, and
        // this spends the same step again under it.
        VStack(alignment: .leading, spacing: ArgoTicketDetail.stripStep) {
            VStack(alignment: .leading, spacing: ArgoTicketDetail.stripLift) {
                TicketHead(ticket: ticket, openSession: openSession)
                TicketFactStrip(ticket: ticket)
            }
            TicketBody(ticket: ticket, open: open)
        }
        .padding(ArgoTicketDetail.inset)
        // The feed's measure, REUSED: the feed already settled what a line of Argo's prose runs to,
        // and a second cap here would be a second answer to one question.
        .argoFeedMeasure()
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        ticket: TicketsRoomProjection.Detail?,
        unreadNumber: Int? = nil,
        open: @escaping (Int) -> Void,
        openSession: @escaping (CockpitPresentation.Session.ID) -> Void = { _ in },
    ) {
        self.ticket = ticket
        self.unreadNumber = unreadNumber
        self.open = open
        self.openSession = openSession
    }
}

#Preview("Ticket detail — nothing selected") {
    TicketDetail(ticket: nil, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket detail — a link to a ticket nothing was read for") {
    TicketDetail(ticket: nil, unreadNumber: 264, open: { _ in })
        .frame(width: ArgoTicketDetail.idealWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
