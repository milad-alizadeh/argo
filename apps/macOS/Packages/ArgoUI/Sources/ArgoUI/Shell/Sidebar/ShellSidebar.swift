import SwiftUI

/// Session navigation on the system sidebar material.
///
/// The Project strip is gone: switching Projects is the toolbar vessel's drawer now, and leaving
/// the strip beside it put two switchers on screen with two different ideas of which Project was
/// active — the initialled mark that sent this surface out of the sidebar in the first place, plus
/// an amber dot still meaning "folder not found" where the drawer says it in words.
///
/// It is also where the roster's PUBLISHED order is decided, because that decision needs a fact
/// the engine does not have: whether the reader is in this list. The Hub keeps sorting by newest
/// activity — a live key that moves on every record either agent writes — and this holds the
/// resulting order still while somebody is reading it, letting it re-settle once they are not.
struct ShellSidebar: View {
    /// How long the order stays held after the last sign of a reader. Long enough that crossing
    /// the list on the way somewhere else is not a re-settle; short enough that a sidebar nobody
    /// is in goes back to answering "what moved last" while the answer still matters.
    private static let quiet = Duration.seconds(2)

    let presentation: CockpitPresentation
    @Binding var selection: CockpitPresentation.Session.ID?
    /// Clear a Session off the roster, or put one back — the only thing that ever does either
    /// (#502, story 14). Inert by default, so a preview draws the gesture without a store.
    var archive: (String, Bool) -> Void = { _, _ in }

    @State private var order = RosterOrder()
    @State private var isPointerInside = false
    /// Bumped by anything that says the reader is still here, which restarts the quiet interval.
    ///
    /// Keyboard focus is deliberately NOT one of these. A pointer leaving the list clears itself,
    /// but focus does not: a Session clicked and then left alone would hold the order frozen for
    /// as long as the window stayed frontmost, which is the opposite of re-settling when quiet.
    /// Walking the roster with the arrow keys changes the selection, and that is the signal.
    @State private var interactions = 0

    var body: some View {
        let rows = order.published(SessionRosterProjection.rows(from: presentation.sessions))

        SessionNavigator(
            rows: rows,
            // Not held by the order above: the foot is not a place anything is reached for in
            // a hurry, so a row settling into it under a reader costs nothing.
            archived: SessionRosterProjection.archivedRows(from: presentation.sessions),
            selection: $selection,
            archive: archive,
        )
        .onHover { isPointerInside = $0 }
        .argoAnimation(.resettle, value: rows.map(\.id))
        // What the held order has absorbed, recorded so a row admitted once stays where it
        // was put. Read off the PUBLISHED rows, which is what makes it a fixed point rather
        // than a second placement decision.
        .onChange(of: rows.map(\.id)) { _, ids in
            order.admit(ids)
        }
        .onChange(of: selection) { _, _ in
            interactions += 1
        }
        .task(id: Reading(isPointerInside: isPointerInside, interactions: interactions)) {
            await settle(to: rows.map(\.id))
        }
    }

    /// Held from the moment a reader is in the list, and re-settled a quiet interval after the
    /// last sign of one — never the instant they leave, which is the same surprise moved later.
    /// A pointer still inside holds it open with no timer at all: the signal clears itself.
    private func settle(to ids: [String]) async {
        guard isPointerInside || interactions > 0 else { return }
        order.hold(ids)
        guard !isPointerInside else { return }
        try? await Task.sleep(for: Self.quiet)
        // Cancellation is the only thing `sleep` throws, and it means a fresher reading of this
        // arrived — releasing anyway would re-settle under the reader it just detected.
        guard !Task.isCancelled else { return }
        order.release()
    }

    /// The whole of "somebody is reading this", as one value, because `task(id:)` restarts on one.
    private struct Reading: Equatable {
        let isPointerInside: Bool
        let interactions: Int
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
