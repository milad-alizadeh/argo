import SwiftUI

/// Tickets named from inside a ticket — the Children and `blockedBy` sections, which are ONE
/// component with two callers (#815). The count changes nothing: it lives in the section heading.
struct TicketLinkList: View {
    let links: [TicketsRoomProjection.Link]
    /// `nil` where a row opens nothing: a blocker may be closed and out of the backlog, so its row
    /// is text rather than a control that would lead somewhere empty.
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

    let link: TicketsRoomProjection.Link

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

    /// Nothing where the poll never reached it — a stand-in reads as the ticket's actual title.
    @ViewBuilder private var title: some View {
        if let title = link.title {
            Text(title)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.tail)
                // The design's own lesson about narrow columns: the fix for a clipped title is
                // the id plus a hover, never a wider column.
                .help(title)
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
    if let children = TicketsFixture.room(showing: 607).ticket?.children {
        TicketLinkList(links: children.open, open: { _ in })
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}

#Preview("Link list — six blockers, one of them never read") {
    if let ticket = TicketsFixture.room(showing: 607).ticket {
        TicketLinkList(links: ticket.blockedBy)
            .padding(ArgoTicketDetail.inset)
            .frame(width: ArgoTicketDetail.idealWidth)
            .argoDeckSurface()
            .argoAppearance()
    }
}
