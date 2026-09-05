import ArgoAtoms
import ArgoDesign
import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
package struct SessionNavigator: View {
    /// Internal rather than private for the split into `SessionNavigator+Rows.swift`: an
    /// extension in another file cannot see a view's private members.
    @Environment(\.argo) var argo

    package let rows: [SessionRosterProjection.Row]
    /// What is behind the foot. Which list a Session belongs to is the projection's decision.
    var archived: [SessionRosterProjection.Row] = []
    /// Every selected row, the row the deck is drawing, and the way to move it (#1247). The
    /// `List`'s own binding and Argo's ground are both read off the one selection in here.
    var held: RowSelectionHold<CockpitPresentation.Session.ID>
    /// Clear a Session off the roster, or put one back. Inert by default, so every preview and
    /// specimen draws the gesture without wiring a store to it.
    var archive: ([String], Bool) -> Void = { _, _ in }
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

    /// Whether the list is resting against its top edge. Read off the scroll geometry rather than
    /// tracked from the gestures, because the offset moves for reasons no gesture reports — a
    /// keyboard selection, a row leaving, the window resizing (#1235).
    @State private var isAtTop = true

    /// The list, and the two things scrolled from outside it: a Session landing at the roster's
    /// head brings a list that is already at the top back to the top (#1235), and a selection made
    /// on another surface brings its own row into view — `RosterReveal` (#1273).
    package var body: some View {
        ScrollViewReader { roster in
            list
                .onChange(of: rows.first?.id) { previous, leading in
                    guard let top = SessionRosterProjection.topRow(
                        whenHeadMovedFrom: previous, to: leading, isAtTop: isAtTop,
                    ) else { return }
                    roster.scrollTo(top, anchor: .top)
                }
                .modifier(RosterReveal(selection: held.pointed, drawn: drawnRows, roster: roster))
        }
    }

    /// Every row a range may reach: what the list is drawing, minus the folds, which are opened
    /// rather than selected. A row behind a shut fold is not in `rows` at all, which is what keeps
    /// a range off rows the reader cannot see (#1247).
    var selectableRows: [CockpitPresentation.Session.ID] {
        drawnRows.filter(\.takesSelection).map(\.id)
    }

    /// Every row the list is drawing, in its order — the kept rows, and what is behind the foot
    /// only while the foot is open. Read here rather than by the body, because a scroll may only
    /// name a row the list actually has.
    var drawnRows: [SessionRosterProjection.Row] {
        rows + (isArchiveOpen ? archived : [])
    }

    /// The `List`'s own selection, which is the held set and nothing beside it. Written back
    /// through `absorb`, so a click the platform answered — anywhere but the title, and every
    /// keyboard move — reaches the anchor and the deck by the same route a click on the title
    /// does.
    private var listSelection: Binding<Set<CockpitPresentation.Session.ID>> {
        Binding(get: { held.selection.rows }, set: { held.selection.absorb($0) })
    }

    private var list: some View {
        List(selection: listSelection) {
            if rows.isEmpty, archived.isEmpty {
                emptyState.previewSafeListRow()
            } else {
                ForEach(rows) { row in
                    swipeable(row)
                }
            }
            archivedFoot
        }
        // The whole reading of "is the reader at the top", in the one place it can be read from.
        // Compared against the top inset and not against zero: a list resting at its top sits at
        // MINUS its inset, and a rule written against zero would call every roster scrolled.
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y <= -geometry.contentInsets.top
        } action: { _, atTop in
            isAtTop = atTop
        }
        // `.sidebar` carries the window's system material (D3), so the roster may not trade it
        // for a styled list. What it does NOT carry is a selection this app can colour: on macOS
        // 26 the style's capsule is a fixed neutral, and neither `.tint` nor the `AccentColor`
        // asset moves it by a value — both measured off a render with a scarlet probe (#875,
        // amending D30, which recorded the asset as the route). Nor does the style stop drawing
        // it on its own, and it paints the row under a held click before the binding moves: the
        // probe under each row's ground switches the table's own selection drawing off (#1137), so
        // the ground is the only selection paint in the roster.
        .listStyle(.sidebar)
        // Over the whole list, not the chevron alone: dropping the section's `isExpanded:` gave up
        // the system's own expansion, so the rows arrive on this instead of in the click's frame.
        .argoAnimation(.reveal, value: isArchiveOpen)
        // The foot is shut whenever it comes back, not left open from the last time it existed.
        .onChange(of: archived.isEmpty) { _, isEmpty in
            isArchiveShowing = isArchiveShowing && !isEmpty
        }
        // The deck follows the last row CLICKED, wherever the click landed — the title's own
        // layer, the platform's row, or the keyboard. Guarded against the row the deck already
        // draws, so pointing the window from outside the roster is one pick and not two (#1247).
        .onChange(of: held.selection.last) { _, row in
            guard row != held.pointed else { return }
            held.pick(row)
        }
        // A row the list has stopped drawing is not selected any more: a fold shut over a range
        // must not leave the menu offering to archive what is behind it. An EMPTY roster is
        // skipped — the list draws empty for a moment between a Project switch and the first
        // reading, and reconciliation is what clears a selection for real.
        .onChange(of: selectableRows) { _, drawn in
            guard !drawn.isEmpty else { return }
            held.selection.confine(to: drawn)
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
            showing: isArchiveShowing, selection: held.pointed, in: archived,
        )
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        rows: [SessionRosterProjection.Row],
        archived: [SessionRosterProjection.Row] = [],
        held: RowSelectionHold<CockpitPresentation.Session.ID>,
        archive: @escaping ([String], Bool) -> Void = { _, _ in },
        rename: @escaping (String, String?) -> Void = { _, _ in },
        renamingRowID: Binding<String?> = .constant(nil),
        openFold: @escaping (String) -> Void = { _ in },
        isArchiveRevealed: Bool = false,
    ) {
        self.rows = rows
        self.archived = archived
        self.held = held
        self.archive = archive
        self.rename = rename
        self.renamingRowID = renamingRowID
        self.openFold = openFold
        self.isArchiveRevealed = isArchiveRevealed
    }
}

#Preview("Sessions navigation — empty") {
    SessionNavigator(rows: [], held: .init(selection: .constant(RowSelection())))
        .frame(width: 320, height: 480)
        .argoAppearance()
}
