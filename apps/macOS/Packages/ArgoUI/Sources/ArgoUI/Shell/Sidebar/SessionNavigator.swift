import ArgoAtoms
import ArgoDesign
import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
package struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    package let rows: [SessionRosterProjection.Row]
    /// What is behind the foot. Which list a Session belongs to is the projection's decision.
    var archived: [SessionRosterProjection.Row] = []
    @Binding var selection: CockpitPresentation.Session.ID?
    /// Clear a Session off the roster, or put one back. Inert by default, so every preview and
    /// specimen draws the gesture without wiring a store to it.
    var archive: (String, Bool) -> Void = { _, _ in }
    /// Name a Session, or — with `nil` — drop the name it has. Inert by default, like the archive.
    var rename: (String, String?) -> Void = { _, _ in }
    /// Which row is being typed into, if any — at most one, by construction. Held above the rows
    /// because the menu bar's Rename opens it too, and a state per row could only ever be set by
    /// the row that owns it.
    var renamingRowID: Binding<String?> = .constant(nil)
    /// Open a fold, or shut it (#1073). Inert by default: a preview draws a folded roster
    /// without owning the set of open ones.
    var openFold: (String) -> Void = { _ in }

    /// Opens the foot for the render harness, out-ranking the state so it cannot be shut under it —
    /// as `PlanPill.isRevealed` does, and for the same reason.
    var isArchiveRevealed = false

    /// Shut on launch. Going back to an archived Session is deliberate (story 15), and a foot
    /// that opened itself would put the cleared rows back under the ones that were kept.
    @State private var isArchiveShowing = false

    package var body: some View {
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
        // `.sidebar` carries the window's system material (D3), so the roster may not trade it
        // for a styled list. What it does NOT carry is a selection this app can colour: on macOS
        // 26 the style's capsule is a fixed neutral, and neither `.tint` nor the `AccentColor`
        // asset moves it by a value — both measured off a render with a scarlet probe (#875,
        // amending D30, which recorded the asset as the route). Nor does the style stop drawing
        // it: the ground below COVERS the capsule, which is why it is opaque (#922) — on the row
        // THIS view calls selected, and only there. The platform draws its fill on whichever row
        // its own selection names, so the two must never be allowed to name different rows.
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
                    foot: foot,
                    isShowing: isArchiveOpen,
                    toggle: { isArchiveShowing.toggle() },
                )
            }
        }
    }

    /// The one answer to "is the foot open", read by the rows and by the chevron alike — a mark
    /// drawn from a second reading can report the wrong state. The harness's override is the
    /// view's; everything else is the roster's own, stated where a test can reach it.
    private var isArchiveOpen: Bool {
        isArchiveRevealed || SessionRosterProjection.isArchiveOpen(
            showing: isArchiveShowing, selection: selection, in: archived,
        )
    }

    /// `.swipeActions` gives the system's reveal, spring back, close-when-another-opens and
    /// full-swipe commit. `allowsFullSwipe` is what keeps story 12 — a hard pull still archives
    /// outright, without a second click.
    @ViewBuilder private func swipeable(_ row: SessionRosterProjection.Row) -> some View {
        let drawn = SessionRow(
            row: row,
            rename: { rename(row.id, $0) },
            isRenaming: Binding(
                get: { renamingRowID.wrappedValue == row.id },
                set: { renamingRowID.wrappedValue = $0 ? row.id : nil },
            ),
            // The selection the `List`'s own click would have made, made by the row instead — the
            // row carries a double-click, and the two cannot share one click. Written through the
            // same binding, so the highlight, the keyboard and the deck all still read one fact.
            select: { chose(row) },
        )
        .previewSafeListRow()

        // A fold takes neither tag nor selection, deliberately: `ForEach` tags a row with its
        // `Identifiable` id whether or not `.tag` is written, so leaving `.tag` off never kept the
        // platform off a fold — and a fold is the one row the ground below never covers.
        // `selectionDisabled` is how the app refuses that fill everywhere else (`BacklogList`). It
        // is archived and renamed through the runs under it, so it carries neither gesture either.
        if row.takesSelection {
            drawn
                // Holds its colour while the list is not first responder, where the platform greys
                // its own selection out: this is the one piece of state a reader tracks all day.
                // First responder, the platform's own fill is the `AccentColor` asset at full
                // strength, so a row this misses is not a quiet miss — it is a saturated blue row
                // (D30, 2026-08-31).
                .argoSelectedRowGround(isSelected: reading.isSelected(row))
                .tag(row.id)
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(
                        SessionArchiveProjection.title(isArchived: row.isArchived),
                        systemImage: SessionArchiveProjection.symbol(isArchived: row.isArchived),
                    ) {
                        archive(row.id, !row.isArchived)
                    }
                    .tint(argo.color.interaction.destructive)
                }
        } else {
            // Refused outright rather than covered: there is no ground to cover it with.
            drawn.selectionDisabled()
        }
    }

    /// The one reading of "which row is selected", which the ground is drawn from.
    private var reading: SessionRosterProjection.Selection {
        SessionRosterProjection.Selection(named: selection)
    }

    /// What a click on a row does. A fold is not a Session, so it cannot be selected: it OPENS,
    /// and the runs under it are then ordinary rows the reader can select one by one (#1073).
    private func chose(_ row: SessionRosterProjection.Row) {
        if row.takesSelection {
            selection = row.id
        } else {
            openFold(row.id)
        }
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

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        rows: [SessionRosterProjection.Row],
        archived: [SessionRosterProjection.Row] = [],
        selection: Binding<CockpitPresentation.Session.ID?>,
        archive: @escaping (String, Bool) -> Void = { _, _ in },
        rename: @escaping (String, String?) -> Void = { _, _ in },
        renamingRowID: Binding<String?> = .constant(nil),
        openFold: @escaping (String) -> Void = { _ in },
        isArchiveRevealed: Bool = false,
    ) {
        self.rows = rows
        self.archived = archived
        _selection = selection
        self.archive = archive
        self.rename = rename
        self.renamingRowID = renamingRowID
        self.openFold = openFold
        self.isArchiveRevealed = isArchiveRevealed
    }
}

#Preview("Sessions navigation — empty") {
    SessionNavigator(rows: [], selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}
