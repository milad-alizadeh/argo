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
    /// Which room the window is in. Here because the rooms picker is the sidebar's strip and no
    /// longer the titlebar's (#816) — the Work room's sidebar draws the same control, so a reader
    /// leaving Work has a way back to it.
    var room: Binding<CockpitRoom> = .constant(.sessions)
    /// Clear a Session off the roster, or put one back (#502, story 14). Inert by default, so a
    /// preview draws the gesture without a store.
    var archive: (String, Bool) -> Void = { _, _ in }
    /// Name a Session, or drop the name it has (#502, story 18). Inert by default.
    var rename: (String, String?) -> Void = { _, _ in }
    /// Passed in rather than held here: the menu bar's Rename sets it from outside the sidebar
    /// entirely (`SessionCommands`).
    var renamingSessionID: Binding<String?> = .constant(nil)

    /// The pipeline and the order it publishes in, in one value. Which step comes before which is
    /// `RosterListing`'s and no longer this body's — see the invariants stated there.
    @State private var roster = RosterListing()
    /// The sidebar's own, not the presentation's: a restart mid-search comes back to the whole
    /// list.
    @State private var query = ""

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            RoomStrip(selection: room)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.vertical, ArgoSpacing.base)
            navigator
        }
    }

    /// Split out from `body` so the strip above it stays one line: the roster is the sidebar's
    /// content, and the strip is the window's control sitting over it.
    private var navigator: some View {
        let reading = roster.reading(of: presentation.sessions, matching: query)

        return SessionNavigator(
            rows: reading.rows,
            archived: reading.archived,
            selection: $selection,
            archive: archive,
            rename: rename,
            isFiltered: !query.isEmpty,
            renamingRowID: renamingSessionID,
        )
        .searchable(text: $query, placement: .sidebar, prompt: "Search Sessions")
        .argoAnimation(.resettle, value: reading.rows.map(\.id))
        // Read off the PUBLISHED roster, which is what makes this a fixed point rather than a
        // second placement decision: a row admitted once stays where it was put. The captured
        // `reading` IS the new value — SwiftUI runs the action closure installed by the body pass
        // that produced the change, so `reading.ids` here equals the ids it fired on.
        .onChange(of: reading.ids) { _, _ in
            roster.admit(reading)
        }
        .onChange(of: activeState, initial: true) { previous, state in
            // A window is not reported active for the first moments of its life, and those are
            // exactly the moments the roster was reshuffling in.
            let isFirstDraw = previous == state
            if state == .inactive, !isFirstDraw {
                roster.release()
            } else {
                roster.hold(reading)
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
