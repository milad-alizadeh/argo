import SwiftUI

/// One row of the backlog: `twist · dot · id · title`, and one trailing fact. The priority headers
/// over it are their own ticket, and the row's shape does not change when they arrive.
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

    /// The roll-up, and the hover that keeps it from being reported as a bug: a number nobody can
    /// reconcile against the rows under it has to say why on the spot.
    @ViewBuilder private var trailing: some View {
        if let fact = row.trailing {
            Text(fact)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
                .help("\(fact) — the tracker's own count of closed children, including children "
                    + "the backlog does not draw.")
        }
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    private var announcement: String {
        [String(row.id), row.title, row.trailing].compactMap(\.self).joined(separator: ", ")
    }
}

#Preview("Backlog rows — a parent, a leaf and every Delivery state") {
    List {
        ForEach(WorkRoomProjection.drawn(WorkFixture.room.backlog, shut: [])) { drawn in
            BacklogRow(drawn: drawn, isOpen: true, toggle: drawn.isParent ? {} : nil)
                .previewSafeListRow()
        }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
