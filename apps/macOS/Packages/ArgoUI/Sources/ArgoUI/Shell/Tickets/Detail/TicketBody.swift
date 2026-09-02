import ArgoAtoms
import ArgoDesign
import SwiftUI

/// What the ticket says, and the three sections under it: Deliveries, Children, Blocked by, in
/// that order (`cockpit-work-room.md` — the ticket detail).
package struct TicketBody: View {
    @Environment(\.argo) private var argo

    let ticket: TicketsRoomProjection.Detail
    /// What opening a child does.
    let open: (Int) -> Void

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.headingStep) {
            deliveries
            prose
            children
            blockedBy
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Always drawn, empty included — the section is a DIRECT reading either way, so silence would
    /// be the one state it cannot mean.
    ///
    /// Headed by `GroupLabel` where Children and Blocked by take `bodyHeading`: the design sets
    /// this one as a caption and those two as headings (`cockpit-work-room.html`, `.cap` vs `h2`).
    @ViewBuilder private var deliveries: some View {
        GroupLabel("Deliveries")
        if ticket.deliveries.isEmpty {
            Text("No Delivery yet")
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.disabled)
        } else {
            // Stacked, never wrapped: at 480 a chip sets on one line.
            VStack(alignment: .leading, spacing: ArgoTicketDetail.chipGap) {
                ForEach(ticket.deliveries) { DeliveryChip(delivery: $0) }
            }
        }
    }

    /// The tracker's own markdown, drawn by the FEED's renderer. It carries the feed's line height
    /// with it, so a paragraph here and a paragraph in a reading set at the same rhythm.
    @ViewBuilder private var prose: some View {
        if let body = ticket.body {
            FeedMarkdown(text: body)
                .foregroundStyle(argo.color.text.secondary)
                .environment(\.proseVoice, argo.color.text.secondary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// A parent adds this to the same view a leaf uses (#272). No Implement action on one.
    @ViewBuilder private var children: some View {
        if let children = ticket.children {
            heading("Children · \(children.closed) of \(children.total) closed")
            if children.open.isEmpty {
                Text("Every child is closed.")
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.disabled)
            } else {
                TicketLinkList(links: children.open, open: open)
            }
        }
    }

    /// Absent when empty, never an empty section (`TicketsRoomProjection.Detail.blockedBy`).
    @ViewBuilder private var blockedBy: some View {
        if !ticket.blockedBy.isEmpty {
            heading("Blocked by · \(ticket.blockedBy.count)")
            TicketLinkList(links: ticket.blockedBy, open: open)
        }
    }

    /// A section's own heading.
    private func heading(_ words: String) -> some View {
        Text(words)
            .argoText(ArgoTypography.bodyHeading)
            .padding(.top, ArgoTicketDetail.sectionLift)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(ticket: TicketsRoomProjection.Detail, open: @escaping (Int) -> Void) {
        self.ticket = ticket
        self.open = open
    }
}
