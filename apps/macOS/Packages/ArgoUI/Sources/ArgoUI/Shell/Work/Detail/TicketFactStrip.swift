import SwiftUI

/// The ticket's facts as a STRIP under the title — priority, type, bucket, then labels, closed by a
/// hairline (`cockpit-work-room.md` — the ticket detail).
///
/// There is no 240pt facts sidebar to put them in: at the ideal window this pane is 480, and a
/// second column inside it would leave neither readable. The strip is what the room trades for
/// showing the list and the ticket at once.
///
/// Two lines rather than one wrapping run, because the gap ALONG a line and the gap BETWEEN the
/// lines are different steps and one `WrapFlow` carries a single gap. Each line still wraps on its
/// own, so a provider with long words or many labels breaks rather than clips.
struct TicketFactStrip: View {
    @Environment(\.argo) private var argo

    let ticket: WorkRoomProjection.Ticket

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.factLineGap) {
            WrapFlow(gap: ArgoTicketDetail.factGap) {
                // Priority and type are the PROVIDER's own words and absent until a port reads one
                // (#388) — a fact nobody has read is left out, never defaulted to a middle rung.
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
            }
            if !ticket.labels.isEmpty {
                pair("Labels") {
                    WrapFlow(gap: ArgoTicketDetail.labelGap) {
                        ForEach(ticket.labels, id: \.self) { LabelChip(label: $0) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, ArgoTicketDetail.stripStep)
        .overlay(alignment: .bottom) { ArgoRule(ink: argo.color.edge.hairline) }
    }

    /// One key and what it says. The key is set in the same role the sidebar's group labels take —
    /// it is doing that job here, naming the thing beside it rather than being read for itself.
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

    /// A provider's word, at the one role in the ramp set at the size the design measured. Not the
    /// bucket's role: the bucket is Argo's filing and stays in the machine face beside the words.
    private func value(_ word: String) -> some View {
        Text(word)
            .argoText(ArgoTypography.control)
            .foregroundStyle(argo.color.text.secondary)
    }
}

#Preview("Fact strip — every fact read") {
    if let ticket = WorkFixture.room.ticket {
        TicketFactStrip(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Fact strip — nothing read but Argo's own bucket") {
    if let ticket = WorkRoomProjection.room(from: WorkFixture.unread).ticket {
        TicketFactStrip(ticket: ticket)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}
