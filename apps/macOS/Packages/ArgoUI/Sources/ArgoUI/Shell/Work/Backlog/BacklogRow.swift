import SwiftUI

/// One row of the backlog: `twist · dot · id · title`, and one trailing fact — a parent's roll-up,
/// or the priority a child does not share with the header over it (#819). One slot, and the roll-up
/// wins it, so the two can never collide.
///
/// The INDENT is the row's, not the list's: `List` insets a whole section, and what moves here is
/// one row against its siblings.
struct BacklogRow: View {
    @Environment(\.argo) private var argo

    let drawn: WorkRoomProjection.Drawn
    /// Whether the twist points down. Meaningless on a leaf, whose slot draws nothing.
    let isOpen: Bool
    /// `nil` on a leaf. Passed in rather than derived: who owns the fold is the outline's business,
    /// and the row only needs to know whether it has one.
    let toggle: (() -> Void)?

    private var row: WorkRoomProjection.Row {
        drawn.row
    }

    var body: some View {
        HStack(spacing: ArgoBacklogList.gap) {
            BacklogTwist(toggle: toggle, isOpen: isOpen)
            DeliveryDot(reading: row.delivery)
            Text("#\(row.id)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(row.title)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoBacklogList.gap)
            trailing
        }
        .padding(.leading, ArgoBacklogList.gutter + ArgoBacklogList.indent(atDepth: drawn.depth))
        .frame(minHeight: ArgoBacklogList.rowHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(announcement)
    }

    /// One fact, in the same caption either way — neither outranks the other. The roll-up's hover
    /// keeps it from being reported as a bug: a number nobody can reconcile against the rows under
    /// it has to say why on the spot. An odd priority needs none — it is the provider's own word,
    /// and the header it disagrees with is a few rows up.
    @ViewBuilder private var trailing: some View {
        if let rollUp = row.trailing {
            caption(rollUp)
                .help("\(rollUp) — the tracker's own count of closed children, including children "
                    + "the backlog does not draw.")
        } else if let odd = drawn.odd {
            caption(odd)
        }
    }

    private func caption(_ fact: String) -> some View {
        Text(fact)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.disabled)
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    private var announcement: String {
        [String(row.id), row.title, drawn.trailing].compactMap(\.self).joined(separator: ", ")
    }
}

#Preview("Backlog rows — a parent, a leaf, an odd priority and every Delivery state") {
    let high = WorkRoomProjection.bands(of: WorkFixture.room.backlog)[0]

    return List {
        ForEach(WorkRoomProjection.drawn(high, shut: [])) { drawn in
            BacklogRow(drawn: drawn, isOpen: true, toggle: drawn.isParent ? {} : nil)
                .previewSafeListRow()
        }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
