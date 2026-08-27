import SwiftUI

/// What the ticket says, and the three sections under it: Deliveries, Children, Blocked by, in that
/// order (`cockpit-work-room.md` — the ticket detail).
///
/// Deliveries lead because they are what is happening NOW; the prose is what was asked for, and the
/// two link sections are the ticket's place in the graph around it.
struct TicketBody: View {
    @Environment(\.argo) private var argo

    let ticket: WorkRoomProjection.Ticket
    /// What opening a child does. The Children section names a ticket where the reader already is,
    /// so drilling in does not mean going back out to the list.
    let open: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.headingStep) {
            deliveries
            prose
            children
            blockedBy
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Always drawn, empty included: whether anything is in flight is the first thing a reader of
    /// this pane is asking, and silence would answer it wrongly.
    @ViewBuilder private var deliveries: some View {
        GroupLabel("Deliveries")
        if ticket.deliveries.isEmpty {
            Text("No Delivery yet")
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.disabled)
        } else {
            // Stacked, never wrapped: at this pane's width a chip sets on one line, so two
            // Deliveries are two chips one above the other rather than a wrapped mess.
            VStack(alignment: .leading, spacing: ArgoTicketDetail.chipGap) {
                ForEach(ticket.deliveries) { DeliveryChip(delivery: $0) }
            }
        }
    }

    /// Set at the feed's own line height, so a paragraph here and a paragraph in a reading are the
    /// same rhythm — the two are read minutes apart in the same window.
    @ViewBuilder private var prose: some View {
        if let body = ticket.body {
            Text(body)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .lineSpacing(ArgoFeedRow.proseLineSpacing)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// A parent adds this to the same view a leaf uses — type is a property, not a rung of a ladder
    /// (#272). No Implement action anywhere on it: work happens at leaves.
    @ViewBuilder private var children: some View {
        if let children = ticket.children {
            heading("Children · \(children.closed) of \(children.total) closed")
            if children.open.isEmpty {
                Text("Every child is closed.")
                    .argoText(ArgoTypography.control)
                    .foregroundStyle(argo.color.text.disabled)
            } else {
                TicketLinkList(links: children.open, open: open)
            }
        }
    }

    /// Absent when there are no edges, never an empty section — a provider that exposes no
    /// dependency information has not told us there are no blockers
    /// (`WorkRoomProjection.Ticket.blockedBy`).
    @ViewBuilder private var blockedBy: some View {
        if !ticket.blockedBy.isEmpty {
            heading("Blocked by · \(ticket.blockedBy.count)")
            TicketLinkList(links: ticket.blockedBy)
        }
    }

    /// A section's own heading, which is `body`'s 13 at semibold: weight is the whole of what lifts
    /// it off the paragraph under it (`ArgoTypography.bodyHeading`).
    private func heading(_ words: String) -> some View {
        Text(words)
            .argoText(ArgoTypography.bodyHeading)
            .padding(.top, ArgoTicketDetail.sectionLift)
    }
}

#Preview("Ticket body — two Deliveries, five children and six blockers") {
    if let ticket = WorkFixture.room(showing: 607).ticket {
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
    if let ticket = WorkRoomProjection.room(from: WorkFixture.edgeless).ticket {
        ScrollView {
            TicketBody(ticket: ticket, open: { _ in })
                .padding(ArgoTicketDetail.inset)
        }
        .frame(width: ArgoTicketDetail.idealWidth, height: 420)
        .argoDeckSurface()
        .argoAppearance()
    }
}
