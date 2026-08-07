import AppKit
import SwiftUI

/// One flat sidebar row over the sidebar's system material.
///
/// The row draws no selection of its own: on macOS 26 the sidebar's own rounded capsule
/// *is* the neutral wash D30 asks for, and it is the same shape Finder, Mail and Xcode
/// select with. Painting a second wash over it produced two stacked highlights, and
/// replacing it means leaving `.listStyle(.sidebar)` — which is what the sidebar's Liquid
/// Glass comes from (D3). Contents only, therefore; selection belongs to the system.
struct SessionRow: View {
    @Environment(\.argo) private var argo

    let row: SessionRosterProjection.Row

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            primaryLine
            Text(row.metadata)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.vertical, ArgoSpacing.tight)
        .contentShape(.rect)
        .help(inspectionText)
        .contextMenu { copyActions }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var primaryLine: some View {
        HStack(spacing: ArgoSpacing.snug) {
            SessionStateIndicator(state: row.state)
            Text(row.title)
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: ArgoSpacing.tight)
            trailingMarks
        }
    }

    /// Everything exceptional about the row, in one right-aligned column. The lock sits here
    /// rather than beside the title so the marks land on a single x across the roster — a
    /// glyph that floats to wherever a title happens to end is a mark you have to hunt for.
    private var trailingMarks: some View {
        HStack(spacing: ArgoSpacing.snug) {
            if row.showsLock {
                Image(systemName: "lock")
                    .foregroundStyle(argo.color.text.tertiary)
                    .accessibilityHidden(true)
            }
            if let word = row.stateWord {
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

    /// The lock can be suppressed as visual noise; the fact behind it never is.
    private var accessibilityLabel: String {
        [row.title, row.stateWord, row.isReadOnly ? "Read-only Session" : nil, row.metadata]
            .compactMap(\.self)
            .joined(separator: ", ")
    }

    private var inspectionText: String {
        [row.title, row.location, row.branch].compactMap(\.self).joined(separator: "\n")
    }

    private func copy(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }
}
