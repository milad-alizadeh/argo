import SwiftUI

/// Session navigation on the system sidebar material. The Project strip is gone: switching Projects
/// is the toolbar vessel's drawer now, and two switchers on screen had two different ideas of which
/// Project was active.
///
/// Also where the roster's PUBLISHED order is decided, because that needs a fact the engine does
/// not have: whether anybody is looking at this window. The Hub keeps sorting by newest activity —
/// a key that moves on every record either agent writes — and this holds the resulting order still
/// for as long as the window is up, re-settling only while it is not. Keyed on the window and not
/// the pointer (#498).
struct ShellSidebar: View {
    /// `.inactive` means the window is not front: nothing on this roster is being read, and it can
    /// go back to answering "what moved last" so it is already right when the reader returns.
    @Environment(\.controlActiveState) private var activeState

    let presentation: CockpitPresentation
    @Binding var selection: CockpitPresentation.Session.ID?
    /// Clear a Session off the roster, or put one back (#502, story 14). Inert by default, so a
    /// preview draws the gesture without a store.
    var archive: (String, Bool) -> Void = { _, _ in }
    /// Name a Session, or drop the name it has (#502, story 18). Inert by default.
    var rename: (String, String?) -> Void = { _, _ in }
    /// Passed in rather than held here: the menu bar's Rename sets it from outside the sidebar
    /// entirely (`SessionCommands`).
    var renamingSessionID: Binding<String?> = .constant(nil)

    @State private var order = RosterOrder()
    /// The sidebar's own, not the presentation's: a restart mid-search comes back to the whole
    /// list.
    @State private var query = ""

    var body: some View {
        // Filtered AFTER the order is published, so searching cannot re-order what is left, and so
        // the held order covers the WHOLE roster rather than only the rows a query kept.
        let ordered = order.published(SessionRosterProjection.rows(from: presentation.sessions))
        let rows = RosterSearch.matching(query, in: ordered)

        SessionNavigator(
            rows: rows,
            // Not held by the order above, and filtered by the same query as the roster: a search
            // that stopped at the fold would answer "no Sessions" about a list it never looked in.
            archived: RosterSearch.matching(
                query, in: SessionRosterProjection.archivedRows(from: presentation.sessions),
            ),
            selection: $selection,
            archive: archive,
            rename: rename,
            isFiltered: !query.isEmpty,
            renamingRowID: renamingSessionID,
        )
        .searchable(text: $query, placement: .sidebar, prompt: "Search Sessions")
        .argoAnimation(.resettle, value: rows.map(\.id))
        // Read off the PUBLISHED rows, which is what makes this a fixed point rather than a
        // second placement decision: a row admitted once stays where it was put.
        .onChange(of: ordered.map(\.id)) { _, ids in
            order.admit(ids)
        }
        .onChange(of: activeState, initial: true) { previous, state in
            // A window is not reported active for the first moments of its life, and those are
            // exactly the moments the roster was reshuffling in.
            let isFirstDraw = previous == state
            if state == .inactive, !isFirstDraw {
                order.release()
            } else {
                order.hold(ordered.map(\.id))
            }
        }
    }
}

#Preview("Continuous sidebar") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    ShellSidebar(presentation: .preview, selection: $selection)
        .frame(width: 340, height: 600)
        .argoAppearance()
}

#Preview("Continuous sidebar — no Sessions") {
    ShellSidebar(presentation: .emptyPreview, selection: .constant(nil))
        .frame(width: 340, height: 600)
        .argoAppearance()
}
