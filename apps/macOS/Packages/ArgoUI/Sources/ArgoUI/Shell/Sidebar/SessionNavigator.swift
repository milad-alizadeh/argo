import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    let rows: [SessionRosterProjection.Row]
    /// What is behind the foot. Which list a Session belongs to is the projection's decision.
    var archived: [SessionRosterProjection.Row] = []
    @Binding var selection: CockpitPresentation.Session.ID?
    /// Clear a Session off the roster, or put one back. Inert by default, so every preview and
    /// specimen draws the gesture without wiring a store to it.
    var archive: (String, Bool) -> Void = { _, _ in }
    /// Name a Session, or — with `nil` — drop the name it has. Inert by default, like the archive.
    var rename: (String, String?) -> Void = { _, _ in }
    /// Whether a search is narrowing the two lists above. It changes only what an EMPTY roster
    /// says: "no Sessions" and "none that match what you typed" are different claims, and a
    /// machine full of Sessions that reported the first would read as one that had lost them.
    var isFiltered = false
    /// Which row is being typed into, if any — at most one, by construction. Held above the rows
    /// because the menu bar's Rename opens it too, and a state per row could only ever be set by
    /// the row that owns it.
    var renamingRowID: Binding<String?> = .constant(nil)

    /// Opens the foot without a click, for the render harness — a click is the only other way in,
    /// and it does not reach a screenshot. It out-ranks the state while set, so the foot cannot be
    /// shut under it: a render is not a click (`PlanPill.isRevealed` holds its list open the same
    /// way, and `docs/agents/visual-verification.md` says why the two are not each other's proof).
    var isArchiveRevealed = false

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
        // Over the whole list, not the chevron alone: dropping the section's `isExpanded:` gave up
        // the system's own expansion, so the rows arrive on this instead of in the click's frame.
        .argoAnimation(.reveal, value: isArchiveOpen)
        // The foot is shut whenever it comes back, not left open from the last time it existed.
        .onChange(of: archived.isEmpty) { _, isEmpty in
            isArchiveShowing = isArchiveShowing && !isEmpty
        }
    }

    /// The archived Sessions, behind a count and shut by default. Absent entirely when nothing
    /// has been archived: a one-time state costs no permanent chrome (`cockpit-spec.md` §4.1).
    ///
    /// The section takes NO `isExpanded:` binding, deliberately: given one, a sidebar section draws
    /// the system's own disclosure under the pointer, and the foot then carries two chevrons with
    /// only that one live. The header owns the gesture instead (`RosterArchiveFoot`).
    @ViewBuilder private var archivedFoot: some View {
        if let foot = SessionRosterProjection.archivedFoot(archived) {
            Section {
                if isArchiveOpen {
                    ForEach(archived) { row in
                        swipeable(row)
                    }
                }
            } header: {
                RosterArchiveFoot(
                    label: foot.label,
                    announcement: foot.announcement,
                    isShowing: isArchiveOpen,
                    toggle: { isArchiveShowing.toggle() },
                )
            }
        }
    }

    /// The one answer to "is the foot open", read by the rows and by the chevron alike — a mark
    /// drawn from a second reading can report the wrong state.
    private var isArchiveOpen: Bool {
        isArchiveShowing || isArchiveRevealed
    }

    /// `.swipeActions` gives the system's reveal, spring back, close-when-another-opens and
    /// full-swipe commit. `allowsFullSwipe` is what keeps story 12 — a hard pull still archives
    /// outright, without a second click.
    private func swipeable(_ row: SessionRosterProjection.Row) -> some View {
        SessionRow(
            row: row,
            rename: { rename(row.id, $0) },
            isRenaming: Binding(
                get: { renamingRowID.wrappedValue == row.id },
                set: { renamingRowID.wrappedValue = $0 ? row.id : nil },
            ),
            // The selection the `List`'s own click would have made, made by the row instead — the
            // row carries a double-click, and the two cannot share one click. Written through the
            // same binding, so the highlight, the keyboard and the deck all still read one fact.
            select: { selection = row.id },
        )
        .previewSafeListRow()
        .tag(row.id)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(archiveLabel(row), systemImage: archiveSymbol(row)) {
                archive(row.id, !row.isArchived)
            }
            .tint(argo.color.interaction.destructive)
        }
    }

    private func archiveSymbol(_ row: SessionRosterProjection.Row) -> String {
        row.isArchived ? ArgoSymbol.unarchive : ArgoSymbol.archive
    }

    private func archiveLabel(_ row: SessionRosterProjection.Row) -> String {
        row.isArchived ? "Put back on the roster" : "Archive Session"
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text(isFiltered ? "No matching Sessions" : "No Sessions yet")
                .argoText(ArgoTypography.rowTitle)
            Text(isFiltered ? "Nothing here matches what you typed." :
                "Observed Sessions appear here.")
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
