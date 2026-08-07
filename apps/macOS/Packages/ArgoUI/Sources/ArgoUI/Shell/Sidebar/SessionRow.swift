import AppKit
import SwiftUI

struct SessionRow: View {
    @Environment(\.argo) private var argo

    let row: SessionRosterProjection.Row
    let isSelected: Bool

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Rectangle()
                .fill(isSelected ? argo.color.interaction.selectionIndicator.color : .clear)
                .frame(width: ArgoStroke.indicator)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                primaryLine
                Text(row.metadata)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .padding(.vertical, ArgoSpacing.tight)
        .help(inspectionText)
        .contextMenu { copyActions }
        .accessibilityElement(children: .combine)
    }

    private var primaryLine: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Text(row.title)
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.middle)
            if row.isReadOnly {
                Image(systemName: "lock")
                    .foregroundStyle(argo.color.text.tertiary)
                    .accessibilityLabel("Read-only Session")
            }
            Spacer(minLength: ArgoSpacing.tight)
            if let state = row.state, let word = row.stateWord {
                SessionStateIndicator(state: state)
                Text(word)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.secondary)
            }
        }
    }

    @ViewBuilder private var copyActions: some View {
        Button("Copy Session title") { copy(row.title) }
        if let location = row.location {
            Button("Copy full location") { copy(location) }
        }
        if let branch = row.branch {
            Button("Copy branch") { copy(branch) }
        }
    }

    private var inspectionText: String {
        [row.title, row.location, row.branch].compactMap(\.self).joined(separator: "\n")
    }

    private func copy(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }
}
