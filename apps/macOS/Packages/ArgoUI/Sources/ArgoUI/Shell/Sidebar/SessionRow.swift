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
            secondaryLine
        }
        .padding(.vertical, ArgoSpacing.tight)
        .contentShape(.rect)
        .help(inspectionText)
        .contextMenu { copyActions }
        .accessibilityElement(children: .combine)
        // The lock can be suppressed as visual noise; the fact behind it never is. What is
        // announced is the projection's decision, not a second one taken here.
        .accessibilityLabel(row.announcement)
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

    /// The age takes the row's own right edge, which is the edge the state word above it takes:
    /// one column down the roster rather than a mark at wherever the text before it ended.
    ///
    /// Absent entirely when neither half is there, rather than an empty `Text`, which would
    /// leave a gap of whatever height the font happened to give it.
    @ViewBuilder private var secondaryLine: some View {
        if row.branch != nil || row.age != nil {
            HStack(spacing: ArgoSpacing.snug) {
                if let branch = row.branch {
                    Text(branch)
                        .argoText(ArgoTypography.rowMeta)
                        .lineLimit(1)
                        // A branch name is addressed from both ends — the ticket at the head and
                        // the subject at the tail. The middle is the part that repeats.
                        .truncationMode(.middle)
                }
                Spacer(minLength: ArgoSpacing.tight)
                if let age = row.age {
                    Text(age)
                        .argoText(ArgoTypography.rowMeta)
                        .lineLimit(1)
                        // The gutter is the age's before it is the branch's.
                        .layoutPriority(1)
                }
            }
            .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// Everything exceptional about the row, in one right-aligned column. The lock sits here
    /// rather than beside the title so the marks land on a single x across the roster — a
    /// glyph that floats to wherever a title happens to end is a mark you have to hunt for.
    private var trailingMarks: some View {
        HStack(spacing: ArgoSpacing.snug) {
            if row.showsLock {
                ArgoGlyph("lock", .inline)
                    .foregroundStyle(argo.color.text.tertiary)
                    .accessibilityHidden(true)
            }
            // The word takes the dot's own ink, so the two never read as separate claims.
            // The contract already carries this: every state ink is asserted legible as a
            // word and not only as a dot. Drawn on the word alone, though — a word the
            // projection spent under a state with no colour would otherwise be announced
            // and never drawn, which is the disagreement the one `stateWord` exists to stop.
            if let word = row.stateWord {
                Text(word)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(row.state?.tint(in: argo.color) ?? argo.color.text.tertiary)
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

#Preview("Session row — every rendering") {
    List {
        ForEach(SessionRosterProjection.previewRows) { row in
            SessionRow(row: row).previewSafeListRow()
        }
    }
    .listStyle(.sidebar)
    .frame(width: 300, height: 340)
    .argoAppearance()
}

#Preview("Session row — at the narrowest sidebar width") {
    List {
        ForEach(SessionRosterProjection.previewRows) { row in
            SessionRow(row: row).previewSafeListRow()
        }
    }
    .listStyle(.sidebar)
    .frame(width: 220, height: 340)
    .argoAppearance()
}
