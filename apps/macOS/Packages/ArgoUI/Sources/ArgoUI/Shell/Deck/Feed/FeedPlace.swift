import SwiftUI

/// Which row the reading is held at, and who is allowed to change it.
///
/// `.scrollPosition(id:)` runs both ways: the scroller elects the topmost row whenever the layout
/// moves and writes it back through the binding. Scrolling is exactly that, so the election is
/// right — but a seam under the reader's hand moves the layout too, and there the election is a
/// feedback loop. The column re-wraps, a different row becomes topmost, the write re-lays the
/// column out, and the next frame elects another one. That is the reading shaking for as long as
/// the seam is held.
///
/// So the place is the scroller's while the column is still and the reader's while it is not. A
/// place that survives a remeasure is one nothing re-decided during it.
enum FeedPlace {
    /// Where the place is kept — and deliberately NOT view state.
    ///
    /// `.scrollPosition(id:)` writes the topmost row back through its binding as the reading moves,
    /// which during a drag is most frames. As `@State` each of those writes invalidates the body
    /// that owns the whole reading, so a thousand-row `ForEach` and every visible row are rebuilt
    /// at drag rate — a cost that scales with the rows in the SESSION rather than the rows on
    /// screen, and measurably two frames in five past the 60fps floor.
    ///
    /// Nothing on screen is drawn from this value, so nothing needs redrawing when it changes —
    /// which is what lets it live outside the invalidation graph at all. It is read back by the
    /// binding's getter, and that runs whenever anything that IS observed re-evaluates the body,
    /// including the one moment the value has to be current: a seam starting to move.
    @MainActor
    final class Store {
        var held: FeedRow.ID?

        init(held: FeedRow.ID? = nil) {
            self.held = held
        }

        /// The store as the two-way binding `.scrollPosition(id:)` wants — spelled here so the view
        /// says what it means (`pin(place.binding, …)`) rather than assembling a closure pair.
        var binding: Binding<FeedRow.ID?> {
            Binding(get: { self.held }, set: { self.held = $0 })
        }
    }

    /// The row the reading stays at, given what the scroller has just elected.
    static func held(
        _ standing: FeedRow.ID?,
        proposed: FeedRow.ID?,
        whileResizing: Bool,
    )
        -> FeedRow.ID? {
        whileResizing
            ? standing
            : proposed
    }

    /// What `.scrollPosition(id:)` is bound to — the two authorities over the offset, in one place.
    ///
    /// It reports NOTHING while the reading is following. The binding writes as well as reads, so
    /// left engaged it puts the topmost row back over the offset every arriving row had just moved:
    /// two authorities over one offset, disagreeing once per line. Reporting nothing leaves the
    /// scroll the only one of them.
    ///
    /// The standing row is recorded whatever that answer, so the row the reader detaches ON is the
    /// row the pin engages at rather than one it has to be told about afterwards — and the write is
    /// refused for as long as a seam is moving, which is `held(_:proposed:whileResizing:)`.
    static func pin(
        _ standing: Binding<FeedRow.ID?>,
        isFollowing: Bool,
        whileResizing: Bool,
    )
        -> Binding<FeedRow.ID?> {
        Binding(
            get: { isFollowing ? nil : standing.wrappedValue },
            set: { proposed in
                standing.wrappedValue = held(
                    standing.wrappedValue,
                    proposed: proposed,
                    whileResizing: whileResizing,
                )
            },
        )
    }
}
