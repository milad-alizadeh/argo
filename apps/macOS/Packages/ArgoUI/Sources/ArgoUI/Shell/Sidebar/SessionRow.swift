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
        // A Session nobody here can drive is drawn quieter as a WHOLE — every element of it at
        // once, including the state dot, which is the loudest thing on a running row. Applied
        // over the assembled row rather than per-element so nothing can be left behind at full
        // strength, and so a fact added to the row inherits it without being told.
        .opacity(row.isReadOnly ? ArgoOpacity.ghosted : ArgoOpacity.full)
        .contentShape(.rect)
        .help(inspectionText)
        .contextMenu { copyActions }
        .accessibilityElement(children: .combine)
        // Ghosting is ink, and ink is nothing a screen reader can hear. What is announced is
        // the projection's decision, not a second one taken here.
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
            stateWord
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

    /// The one exceptional thing the row's first line still carries, on the right edge the age
    /// under it takes — a column of marks reading down the roster rather than a word at wherever
    /// each title happened to end.
    ///
    /// The word takes the dot's own ink, so the two never read as separate claims. The contract
    /// already carries this: every state ink is asserted legible as a word and not only as a dot.
    /// Drawn on the word alone, though — a word the projection spent under a state with no colour
    /// would otherwise be announced and never drawn, which is the disagreement the one
    /// `stateWord` exists to stop.
    @ViewBuilder private var stateWord: some View {
        if let word = row.stateWord {
            Text(word)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(row.state?.tint(in: argo.color) ?? argo.color.text.tertiary)
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
