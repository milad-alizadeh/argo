import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    let rows: [SessionRosterProjection.Row]
    /// What is behind the foot. Passed in beside the roster rather than filtered here, because
    /// which list a Session belongs to is the projection's decision and not the list's.
    var archived: [SessionRosterProjection.Row] = []
    @Binding var selection: CockpitPresentation.Session.ID?
    /// Clear a Session off the roster, or put one back. Inert by default, so every preview and
    /// specimen draws the gesture without wiring a store to it.
    var archive: (String, Bool) -> Void = { _, _ in }

    /// One swipe for the whole list, which is what makes "only one row is ever open" true: a
    /// state per row could only ever close the row that owns it (#514, story 13).
    @State private var swipe = RosterSwipe()
    /// Shut on launch. Going back to an archived Session is deliberate (story 15), and a foot
    /// that opened itself would put the cleared rows back under the ones that were kept.
    @State private var isArchiveShowing = false

    var body: some View {
        List(selection: $selection) {
            if rows.isEmpty, archived.isEmpty {
                emptyState.previewSafeListRow()
            } else {
                ForEach(rows) { row in
                    swipeable(row)
                }
            }
            archivedFoot
        }
        // `.sidebar` carries the window's system material (D3), so the roster may not trade
        // it for a styled list. Selection is that style's own capsule, coloured from the
        // `AccentColor` asset — SwiftUI's `.tint` does not reach it (D30).
        .listStyle(.sidebar)
        // Anything clicked in the roster that is not the revealed control itself is somewhere
        // else, and a row left half open behind the reader is the state story 13 is about.
        // Simultaneous, so the List still takes the click as a selection.
        .simultaneousGesture(TapGesture().onEnded { swipe.close() })
        .onChange(of: selection) { _, _ in
            swipe.close()
        }
        // The foot is shut whenever it comes back, not left open from the last time it existed.
        .onChange(of: archived.isEmpty) { _, isEmpty in
            isArchiveShowing = isArchiveShowing && !isEmpty
        }
    }

    /// The archived Sessions, behind a count and shut by default. Absent entirely when nothing
    /// has been archived: a one-time state costs no permanent chrome (`cockpit-spec.md` §4.1).
    @ViewBuilder private var archivedFoot: some View {
        if let label = SessionRosterProjection.archivedFoot(archived) {
            Section(isExpanded: $isArchiveShowing) {
                ForEach(archived) { row in
                    swipeable(row)
                }
            } header: {
                Text(label)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
    }

    /// Which way the gesture goes is the row's own state and not a second reading of which list
    /// it was drawn in — two sources for one fact is how they come to disagree.
    private func swipeable(_ row: SessionRosterProjection.Row) -> some View {
        ArchiveSwipeRow(row: row, swipe: $swipe, archive: { archive(row.id, !row.isArchived) })
            .previewSafeListRow()
            .tag(row.id)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("No Sessions yet")
                .argoText(ArgoTypography.rowTitle)
            Text("Observed Sessions appear here.")
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
        }
        .padding(.vertical, ArgoSpacing.tight)
        .listRowSeparator(.hidden)
    }
}

#Preview("Sessions navigation") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    SessionNavigator(rows: SessionRosterProjection.previewRows, selection: $selection)
        .frame(width: 280, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — no selection") {
    SessionNavigator(rows: SessionRosterProjection.previewRows, selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — with an archive at the foot") {
    SessionNavigator(
        rows: ArchivedRosterSpecimen.rows,
        archived: ArchivedRosterSpecimen.archived,
        selection: .constant(nil),
    )
    .frame(width: 320, height: 480)
    .argoAppearance()
}

#Preview("Sessions navigation — empty") {
    SessionNavigator(rows: [], selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}
