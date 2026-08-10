import SwiftUI

/// Session navigation on the system sidebar material.
///
/// The Project strip is gone: switching Projects is the toolbar vessel's drawer now, and leaving
/// the strip beside it put two switchers on screen with two different ideas of which Project was
/// active — the initialled mark that sent this surface out of the sidebar in the first place, plus
/// an amber dot still meaning "folder not found" where the drawer says it in words.
///
/// It is also where the roster's PUBLISHED order is decided, because that decision needs a fact
/// the engine does not have: whether anybody is looking at this window. The Hub keeps sorting by
/// newest activity — a live key that moves on every record either agent writes — and this holds
/// the resulting order still for as long as the window is up, re-settling only while it is not.
///
/// The window and not the pointer, which is what this held before (#498) and what left the roster
/// still reshuffling on launch: a list nobody had touched yet was never holding anything, so two
/// working agents traded places once a second in front of a reader who had not arrived by the one
/// route the sidebar was watching for. A frozen roster is one that does not move while you can see
/// it — the pointer being elsewhere on screen is not permission to reshuffle.
struct ShellSidebar: View {
    /// `.inactive` means the window is not front: nothing on this roster is being read, and it can
    /// go back to answering "what moved last" so it is already right when the reader returns.
    @Environment(\.controlActiveState) private var activeState

    let presentation: CockpitPresentation
    @Binding var selection: CockpitPresentation.Session.ID?
    /// Clear a Session off the roster, or put one back — the only thing that ever does either
    /// (#502, story 14). Inert by default, so a preview draws the gesture without a store.
    var archive: (String, Bool) -> Void = { _, _ in }
    /// Name a Session, or drop the name it has (#502, story 18). Inert by default, for the reason
    /// the archive above it is.
    var rename: (String, String?) -> Void = { _, _ in }
    /// Which row is being typed into. Passed in rather than held here, because the menu bar's
    /// Rename sets it from outside the sidebar entirely (`SessionCommands`).
    var renamingSessionID: Binding<String?> = .constant(nil)

    @State private var order = RosterOrder()
    /// What is typed in the search field. The sidebar's own and not the presentation's: a filter is
    /// a way of LOOKING at the roster, and a machine that restarted mid-search should come back to
    /// the whole list rather than to three rows and no memory of why.
    @State private var query = ""

    var body: some View {
        // Filtered AFTER the order is published, so searching cannot re-order what is left: the
        // rows a query keeps stay in the order the roster already had them in. The order itself is
        // held over the WHOLE roster and not over what a query left of it — a freeze taken on three
        // matching rows would have nothing to say about the ones the query hid.
        let ordered = order.published(SessionRosterProjection.rows(from: presentation.sessions))
        let rows = RosterSearch.matching(query, in: ordered)

        SessionNavigator(
            rows: rows,
            // Not held by the order above: the foot is not a place anything is reached for in
            // a hurry, so a row settling into it under a reader costs nothing.
            //
            // Filtered by the same query as the roster, because a Session you cannot find on it is
            // exactly the one you might have archived — a search that stopped at the fold would
            // answer "no Sessions" about a list it never looked in.
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
        // What the held order has absorbed, recorded so a row admitted once stays where it
        // was put. Read off the PUBLISHED rows, which is what makes it a fixed point rather
        // than a second placement decision.
        .onChange(of: ordered.map(\.id)) { _, ids in
            order.admit(ids)
        }
        // Taken when the roster is first drawn, released only when the window goes away.
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
