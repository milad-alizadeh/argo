import SwiftUI

/// The ticket's facts under the title — priority, type, bucket, then labels, closed by a hairline
/// (`cockpit-work-room.md` — the ticket detail).
///
/// One wrapping run: at 480 the three fact pairs set on one line and the labels take the next,
/// which is what every render shows, but a provider with longer words breaks wherever it must.
struct TicketFactStrip: View {
    @Environment(\.argo) private var argo

    let ticket: TicketsRoomProjection.Detail

    var body: some View {
        WrapFlow(along: ArgoTicketDetail.factGap, between: ArgoTicketDetail.factLineGap) {
            // Absent until a port reads one (#388), never defaulted to a rung nobody named.
            if let priority = ticket.priority {
                pair("Priority") { value(priority) }
            }
            if let type = ticket.type {
                pair("Type") { value(type) }
            }
            pair("Bucket") {
                Text(ticket.bucket.filing)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.secondary)
            }
            if !ticket.labels.isEmpty {
                pair("Labels") {
                    WrapFlow(gap: ArgoTicketDetail.labelGap) {
                        ForEach(ticket.labels) { LabelChip(label: $0) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, ArgoTicketDetail.stripStep)
        .overlay(alignment: .bottom) { ArgoRule(ink: argo.color.edge.hairline) }
    }

    /// One key and what it says.
    private func pair(
        _ key: String, @ViewBuilder said: () -> some View,
    )
        -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoTicketDetail.factPairGap) {
            GroupLabel(key)
            said()
        }
        .accessibilityElement(children: .combine)
    }

    /// A provider's word, at the pane's one value role.
    private func value(_ word: String) -> some View {
        Text(word)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.secondary)
    }
}

#Preview("Fact strip — every fact read") {
    if let ticket = TicketsFixture.room.ticket {
        TicketFactStrip(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Fact strip — nothing read but Argo's own bucket") {
    if let ticket = TicketsRoomProjection.room(from: TicketsFixture.unread).ticket {
        TicketFactStrip(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}
