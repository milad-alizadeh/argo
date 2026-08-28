import SwiftUI

/// One row of the backlog: `twist · dot · id · title`, then the ticket's labels and one trailing
/// fact — a parent's roll-up, or the priority a child does not share with the header over it
/// (#819).
///
/// The INDENT is the row's, not the list's: `List` insets a whole section, and what moves here is
/// one row against its siblings.
struct BacklogRow: View {
    @Environment(\.argo) private var argo
    /// How wide the pane drawing this row is. The chips are RIGID — they would take the title's
    /// last characters rather than give up their own — so under `ArgoBacklogList.labelsAppearAt`
    /// they stand down instead. Read from the room rather than measured here: a row inside a
    /// `List` is proposed a width it cannot compare against the pane's own.
    @Environment(\.backlogPaneWidth) private var paneWidth

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
        line
            .frame(minHeight: ArgoBacklogList.rowHeight)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(announcement)
    }

    private var line: some View {
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
                // A rail is on screen for a descendant's sake rather than for its own match, so its
                // title takes the demotion the `#id` beside it already carries — without it the
                // heading's `1 result` stands over three rows a reader would count as three (#873).
                .foregroundStyle(row.isRail ? argo.color.text.tertiary : argo.color.text.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoBacklogList.gap)
            labels
            trailing
        }
        .padding(.leading, ArgoBacklogList.gutter + ArgoBacklogList.indent(atDepth: drawn.depth))
    }

    /// The provider's own labels, cut by `BacklogRowLabels`, which also decides what the
    /// announcement says. A width narrow enough to drop the chips does NOT quiet the announcement:
    /// a screen reader has no column to run out of, and the cut here is about space rather than
    /// about what the ticket is.
    @ViewBuilder private var labels: some View {
        let reading = BacklogRowLabels(row.labels)
        if !reading.shown.isEmpty, paneWidth >= ArgoBacklogList.labelsAppearAt {
            HStack(spacing: ArgoBacklogList.labelGap) {
                ForEach(reading.shown) { LabelChip(label: $0) }
                // Counted rather than listed: the row has no width for the rest, and silence about
                // them would leave a ticket whose distinguishing label is third looking like one
                // with two labels.
                if let marker = reading.marker {
                    LabelChip(counting: marker)
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
        ([String(row.id), row.title] + BacklogRowLabels(row.labels).spoken + [drawn.trailing])
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
