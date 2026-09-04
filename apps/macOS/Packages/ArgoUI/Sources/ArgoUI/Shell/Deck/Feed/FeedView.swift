import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The Session's reading, filling the deck's feed zone. It takes rows and what the deck has open —
/// no Session, no Hub — so the same view draws a live transcript, a specimen and a preview.
///
/// The scrolling itself is `FeedTable`'s (AppKit's), and where it lands is `FeedScrollPolicy`'s.
/// This view reads both off the handle and writes neither.
package struct FeedView: View {
    @Environment(\.argo) private var argo
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Why the deck has nothing to read, where the reading really is empty — see the overlay.
    @Environment(\.argoFeedVacancy) private var vacancy
    /// Whether a deck seam is being dragged — the table degrades its re-measure to the visible rows
    /// for exactly that long.
    @Environment(\.deckIsResizing) private var isResizing

    /// Which reading these rows are — see `FeedReading`. Every piece of per-reading state below is
    /// keyed on it, which is what the deck's `.id(session)` used to do by destroying the lot.
    package var reading = FeedReading.unattached
    package let rows: [FeedRow]
    /// What the deck has open and where the keyboard is. Owned by the deck: opening a row resizes
    /// the column this view is drawn in. Already routed through
    /// `FeedRowSelection.homing(onto:)` by whoever owns it — this view holds no copy to route.
    let selection: FeedRowSelection
    /// Which row the reading opens HELD at, as though the reader had scrolled up to it. A parameter
    /// because a screenshot cannot scroll, and the detached state is otherwise unreachable.
    var held: FeedRow.ID?
    /// What floats over this reading's foot — see `FeedBottomEdge`. It decides the gutter at the
    /// end (`FeedTail`), the fade that lets rows run under a vessel, and how far the way-back
    /// control lifts, all three being one fact about the column's bottom edge.
    var bottomEdge = FeedBottomEdge.bare
    /// This reading's deck — see `KeptDeck`. Taken rather than owned, because the overview lane
    /// beside the reading reads the same one's scroll authority, and because a deck has to outlive
    /// every view identity a switch destroys.
    let deck: KeptDeck

    /// Which prompts the reading OPENS unfolded. A parameter for the reason `held` is one: a still
    /// cannot press a control, and the unfolded state is otherwise unreachable.
    var opensUnfolded: Set<FeedRow.ID> = []

    /// This deck's scroll authority — what the tail, the way-back control and the provisional word
    /// are all drawn off. See `FeedTableHandle`.
    private var table: FeedTableHandle {
        deck.handle
    }

    /// The reader's folds, or what the reading was opened on while they have made none.
    ///
    /// The DECK's, so they are kept and evicted with everything else the reader did to the reading
    /// (ADR-0030, Rule 4). A fold is a row position, and `FeedRow.ID` is a dense one, so folds that
    /// outlived their reading would let out whatever now sits where they were.
    private var folds: Binding<Set<FeedRow.ID>> {
        let deck = deck
        return Binding(
            get: { Self.folds(deck.folds, opening: opensUnfolded) },
            set: { deck.folds = $0 },
        )
    }

    /// The folds the reader made in this deck, or what its reading opens on. Out of the binding so
    /// a suite can ask it.
    static func folds(_ made: Set<FeedRow.ID>?, opening: Set<FeedRow.ID>) -> Set<FeedRow.ID> {
        made ?? opening
    }

    /// The row the user's own words just landed on, while the accent wash stands over it.
    @State var washed: FeedRow.ID?

    package var body: some View {
        FeedTable(
            reading: reading,
            rows: rows,
            selection: selection,
            held: held,
            isResizing: isResizing,
            bottomEdge: bottomEdge,
            washed: washed,
            unfolded: folds,
            deck: deck,
        )
        // The backstop for anything that still hands the keyboard back by writing a row into the
        // focus space: no row resolves there, so the value is translated into the table's focus on
        // sight. The surfaces that close a panel go through `homing(onto:)` instead (#777).
        .onChange(of: selection.focus.wrappedValue) { _, focus in
            guard case let .row(id) = focus else { return }
            table.focus(onto: id)
        }
        // Keyed on the reading as well as the count: another Session's rows arriving is not an
        // arrival, and washing whatever prompt is last in them says the reader sent it.
        .onChange(of: FeedFact(reading: reading, value: rows.count)) { was, now in
            washArrived(between: was, and: now)
        }
        // Cancellation IS the reset: a second send while the first wash stands re-keys
        // the task, and the fresh one times the fresh row.
        .task(id: washed) { await washExpired() }
        // On the reading and NOT on the view: the way-back control and the empty-feed word float
        // over this and must never fade with it.
        .mask { fade }
        .overlay(alignment: .bottomTrailing) { tail }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if !table.isDrawing {
                // Asked of what the DECK has on screen, never of the rows this pass carries: the
                // shell hands the deck it is coming back to an empty feed for the pass that paints
                // the click (`DrawnSession`), and that deck is already drawing the reading.
                //
                // Centred in what the canopy leaves: this word does not scroll, so it cannot use
                // the table's inset the way the rows do.
                //
                // A reading Argo has not measured yet says the same thing as a deck with no
                // reading in it, because it IS the same thing to the reader: nothing is on screen
                // and Argo is why (ADR-0030, Rule 3). The vacancy the window set stands where the
                // reading really is empty; where rows are waiting on a pass, `unread` is the honest
                // one — see `FeedVacancy.unread`, which the deck already used for the frame between
                // the click and the reading.
                FeedSilence()
                    .environment(
                        \.argoFeedVacancy,
                        rows.isEmpty ? vacancy : .unread,
                    )
                    .argoUnderCanopy()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Feed")
    }

    /// The way back down, on screen only while the reading has stopped following.
    private var tail: some View {
        ZStack {
            if !table.isFollowing, !rows.isEmpty {
                FeedTailButton(
                    newMessages: table.leftAt
                        .map { FeedTail.newMessages(in: rows, since: $0) } ?? 0,
                    follow: follow,
                )
                .padding(.trailing, ArgoFeedRow.inset)
                // Lifted clear of the vessel when one floats there.
                .padding(.bottom, bottomEdge.tailLift)
                .transition(.opacity)
            }
        }
        .argoAnimation(.reveal, value: table.isFollowing)
    }

    /// Back to the newest row, because the reader asked. Animated — except under Reduce Motion,
    /// where the whole content of the change is the movement, so it lands instantly.
    private func follow() {
        table.follow(
            over: reduceMotion ? ArgoMotion.selection.reducedDuration : ArgoMotion.selection
                .duration,
        )
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        reading: FeedReading = FeedReading.unattached,
        rows: [FeedRow],
        selection: FeedRowSelection,
        held: FeedRow.ID? = nil,
        bottomEdge: FeedBottomEdge = .bare,
        deck: KeptDeck,
        opensUnfolded: Set<FeedRow.ID> = [],
        washed: FeedRow.ID? = nil,
    ) {
        self.reading = reading
        self.rows = rows
        self.selection = selection
        self.held = held
        self.bottomEdge = bottomEdge
        self.deck = deck
        self.opensUnfolded = opensUnfolded
        _washed = State(wrappedValue: washed)
    }
}
