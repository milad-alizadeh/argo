import SwiftUI

/// Tickets named from inside a ticket — the Children section and the `blockedBy` section, which are
/// ONE component with two callers (#815).
///
/// `blockedBy` at one and at six is the same shape, so nothing here changes with the count: the
/// figure lives in the section heading, and six rows are six rows. What the two callers differ in
/// is the trailing fact — a child carries the provider's word for it, a blocker carries nothing.
struct TicketLinkList: View {
    let links: [WorkRoomProjection.Link]
    /// What opening a row does, and `nil` where a row opens nothing. A blocker may be closed and
    /// out of the backlog entirely, so its row is text rather than a control that would lead
    /// somewhere empty.
    var open: ((Int) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.linkGap) {
            ForEach(links) { link in
                if let open {
                    Button { open(link.id) } label: { TicketLinkRow(link: link) }
                        .buttonStyle(.plain)
                } else {
                    TicketLinkRow(link: link)
                }
            }
        }
    }
}

/// One row of that list: `dot · id · title`, and the trailing fact where there is one.
private struct TicketLinkRow: View {
    @Environment(\.argo) private var argo

    let link: WorkRoomProjection.Link

    var body: some View {
        HStack(spacing: ArgoTicketDetail.linkFieldGap) {
            DeliveryDot(reading: link.delivery)
            Text("#\(link.id)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.secondary)
            title
            Spacer(minLength: ArgoTicketDetail.linkFieldGap)
            trailing
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(announcement)
    }

    /// The tracker's own name, and NOTHING where the poll never reached it. A stand-in a reader
    /// cannot tell from a real title is worse than a row that plainly says only its number — and a
    /// blocker that is already closed still has its name here, because a closed ticket was read
    /// like any other.
    @ViewBuilder private var title: some View {
        if let title = link.title {
            Text(title)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    @ViewBuilder private var trailing: some View {
        if let fact = link.trailing {
            Text(fact)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
        }
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    private var announcement: String {
        [String(link.id), link.title, link.trailing].compactMap(\.self).joined(separator: ", ")
    }
}

#Preview("Link list — children, with the provider's word trailing each") {
    if let children = WorkFixture.room(showing: 607).ticket?.children {
        TicketLinkList(links: children.open, open: { _ in })
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Link list — six blockers, one of them never read") {
    if let ticket = WorkFixture.room(showing: 607).ticket {
        TicketLinkList(links: ticket.blockedBy)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}
