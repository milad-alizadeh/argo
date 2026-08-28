import SwiftUI

/// One row of the backlog: `twist · dot · id · title`, then the ticket's labels and one trailing
/// fact — a parent's roll-up, or the priority a child does not share with the header over it
/// (#819).
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
                // RIGID, so the title is the only thing the row squeezes. Without it a row
                // carrying label chips sets the number down the column, one digit per line.
                .fixedSize()
            Text(row.title)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoBacklogList.gap)
            labels
            trailing
        }
        .padding(.leading, ArgoBacklogList.gutter + ArgoBacklogList.indent(atDepth: drawn.depth))
        .frame(minHeight: ArgoBacklogList.rowHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(announcement)
    }

    /// The provider's own labels, cut to `ArgoBacklogList.labelLimit` and never counted past it —
    /// a `+3` would be a number about labels nobody can read, on a row that has no room to.
    @ViewBuilder private var labels: some View {
        if !row.labels.isEmpty {
            HStack(spacing: ArgoBacklogList.labelGap) {
                ForEach(row.labels.prefix(ArgoBacklogList.labelLimit), id: \.self) {
                    LabelChip(label: $0)
                }
            }
            .lineLimit(1)
            .fixedSize()
        }
    }

    /// Which fact wins the slot is `Drawn.trailing`'s, told once. Only the roll-up carries a hover:
    /// a number nobody can reconcile against the rows under it has to say why on the spot.
    @ViewBuilder private var trailing: some View {
        if let fact = drawn.trailing {
            if let rollUp = row.trailing {
                caption(fact)
                    .help("\(rollUp) — the tracker's own count of closed children, including "
                        + "children the backlog does not draw.")
            } else {
                caption(fact)
            }
        }
    }

    private func caption(_ fact: String) -> some View {
        Text(fact)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.disabled)
            // Rigid for the id's reason: `2/9` is one fact, not a column of two.
            .fixedSize()
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    private var announcement: String {
        ([String(row.id), row.title] + row.labels + [drawn.trailing])
            .compactMap(\.self)
            .joined(separator: ", ")
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
