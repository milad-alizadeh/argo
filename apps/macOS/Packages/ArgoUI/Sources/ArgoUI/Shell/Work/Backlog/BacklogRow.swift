import SwiftUI

/// One row of the backlog: `dot · id · title`, and one trailing fact. Flat — the tree, its twist
/// and the priority headers over it are their own ticket, and the row's shape does not change when
/// they arrive.
struct BacklogRow: View {
    @Environment(\.argo) private var argo

    let row: WorkRoomProjection.Row

    var body: some View {
        HStack(spacing: ArgoBacklogList.gap) {
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
        .padding(.leading, ArgoBacklogList.gutter)
        .frame(minHeight: ArgoBacklogList.rowHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(announcement)
    }

    @ViewBuilder private var trailing: some View {
        if let fact = row.trailing {
            Text(fact)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
        }
    }

    /// The id is spoken as a number rather than as `#607`, which VoiceOver reads as "number 607".
    private var announcement: String {
        [String(row.id), row.title, row.trailing].compactMap(\.self).joined(separator: ", ")
    }
}

#Preview("Backlog rows — a parent, a leaf and every Delivery state") {
    List {
        ForEach(WorkRoomProjection.room(from: WorkFixture.reading).backlog) { row in
            BacklogRow(row: row).previewSafeListRow()
        }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
