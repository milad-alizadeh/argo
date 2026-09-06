import SwiftUI

/// Points the roster's list at the row the roster marked, whoever marked it (#1273).
///
/// A modifier of its own rather than two handlers in `SessionNavigator`, because the debt below is
/// state with one subject: whether this list still owes the reader a look. The navigator owns the
/// rows and the ground; this owns the offset.
struct RosterReveal: ViewModifier {
    /// What the `List`'s binding names — the roster's ONE selected state, verbatim.
    let selection: String?
    /// Every row the list is drawing, in its order. A scroll may only name a row it actually has.
    let drawn: [SessionRosterProjection.Row]
    let roster: ScrollViewProxy

    /// Whether the list has any height to scroll in — see `SessionRosterProjection.reveal`.
    @State private var hasHeight = false
    /// Whether a look is still owed. A flag and not the owed ID, because the ID is never read back:
    /// `revealSelection` asks off the LIVE selection, which by then may be a different string for
    /// the same Session — a fresh Session's row is re-keyed between the write and its arrival
    /// (#361). What is owed is `Reveal.owed`'s to name; all this has to remember is that it is.
    @State private var isOwedALook = false

    func body(content: Content) -> some View {
        content
            // Whether there is a list to be anywhere in — kept apart from the navigator's own
            // reading of WHERE the list is, which is a different question about the same geometry.
            .onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.containerSize.height > 0
            } action: { _, has in
                hasHeight = has
            }
            .onChange(of: selection) { _, _ in
                revealSelection()
            }
            // The two things that pay a debt, which are one rule: the list gaining what it was
            // missing. Either it had no height — the roster's room coming back on screen — or it
            // had no row, because a claim id is written the instant a spawn answers and before the
            // provisional row reaches this list (#1493). By then the selection is long past being
            // a change, so nothing else would ask again. Guarded on the debt, so the roster
            // republishing — which it does on every sweep — scrolls nothing on its own.
            .onChange(of: Occasion(hasHeight: hasHeight, rows: drawn.map(\.id))) { _, _ in
                guard isOwedALook else { return }
                revealSelection()
            }
    }

    /// What the list was missing, in one value: a change to either half is an occasion to try the
    /// debt again, and two handlers spelled one rule twice.
    private struct Occasion: Equatable {
        let hasHeight: Bool
        let rows: [String]
    }

    /// The one ask. `reveal` re-owes what it still cannot pay, so a debt that outlives the pass is
    /// kept rather than dropped — including a selection whose row is behind a shut foot, which is
    /// paid when the reader opens it.
    private func revealSelection() {
        let reveal = SessionRosterProjection.reveal(
            of: selection, among: drawn, hasHeight: hasHeight,
        )
        isOwedALook = reveal.owed != nil
        scroll(to: reveal.row)
    }

    /// No anchor, deliberately: with none, the list scrolls the LEAST it can to put the row on
    /// screen, so a row already in view is left where it is — which is what keeps this off the
    /// reader's own clicks, every one of which is made on a row they can already see.
    private func scroll(to row: String?) {
        guard let row else { return }
        roster.scrollTo(row)
    }
}
