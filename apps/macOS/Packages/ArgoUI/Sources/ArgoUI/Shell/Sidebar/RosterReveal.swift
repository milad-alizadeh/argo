import SwiftUI

/// Points the roster's list at the row the roster marked, whoever marked it (#1273).
///
/// A modifier of its own rather than two handlers in `SessionNavigator`, because the debt below is
/// state with one subject: which row this list still owes the reader a look at. The navigator owns
/// the rows and the ground; this owns the offset.
struct RosterReveal: ViewModifier {
    /// What the `List`'s binding names — the roster's ONE selected state, verbatim.
    let selection: String?
    /// Every row the list is drawing, in its order. A scroll may only name a row it actually has.
    let drawn: [SessionRosterProjection.Row]
    let roster: ScrollViewProxy

    /// Whether the list has any height to scroll in — see `SessionRosterProjection.reveal`.
    @State private var hasHeight = false
    /// What a selection asked for and could not have. Held rather than recomputed, because by the
    /// time the height or the row arrives the selection is no longer a change.
    @State private var owed: String?

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
                ask()
            }
            // The first thing that pays a debt: the roster's room coming back on screen is the
            // list going from no height to the column's.
            .onChange(of: hasHeight) { _, has in
                guard has, owed != nil else { return }
                ask()
            }
            // The second: the row itself arriving. A claim id is written the instant a spawn
            // answers, before the provisional row has reached this list at all (#1493), and by
            // then the selection is long past being a change. Guarded on the debt, so the roster
            // republishing — which it does on every sweep — scrolls nothing on its own.
            .onChange(of: drawn.map(\.id)) { _, _ in
                guard owed != nil else { return }
                ask()
            }
    }

    /// The one ask, made off the LIVE selection rather than the id the debt was recorded under: a
    /// fresh Session's row is re-keyed between the write and its arrival (#361), so the id owed
    /// and the id finally drawn are two different strings for one Session. `reveal` re-owes what
    /// it still cannot pay, so a debt that outlives the pass is kept rather than dropped.
    private func ask() {
        let reveal = SessionRosterProjection.reveal(
            of: selection, among: drawn, hasHeight: hasHeight,
        )
        owed = reveal.owed
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
