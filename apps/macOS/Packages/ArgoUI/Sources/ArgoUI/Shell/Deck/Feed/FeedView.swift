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
    /// Whether the composer floats over this reading. It decides the gutter at the end
    /// (`FeedTail`), the fade that lets rows run under the vessel, and how far the way-back control
    /// lifts — all three being one fact about the column's bottom edge.
    var isUnderComposer = false
    /// The reading's scroll authority — see `FeedTableHandle`. Taken rather than owned, because the
    /// overview lane beside the reading holds the same one, and because it has to be seeded with
    /// `held` before this view exists.
    let table: FeedTableHandle

    /// Which prompts the reading OPENS unfolded. A parameter for the reason `held` is one: a still
    /// cannot press a control, and the unfolded state is otherwise unreachable.
    var opensUnfolded: Set<FeedRow.ID> = []

    /// Which prompts the reader has unfolded, and WHICH READING they unfolded them in. Held here so
    /// it survives the row being rebuilt when the projection hands the feed a newer copy of it.
    /// `nil` until the reader has folded anything, which is what lets `opensUnfolded` stand from
    /// the FIRST frame — a still seeded a frame later renders the folded state and calls it the
    /// unfolded one.
    @State private var unfolded: FeedFact<Set<FeedRow.ID>>?

    /// The reader's folds, or what the reading was opened on while they have made none.
    ///
    /// The reading is compared HERE rather than cleared in an `onChange`: a fold is a row position,
    /// so one carried into another Session unfolds whatever now sits there — and an `onChange`
    /// fires after the pass that already handed those folds to the table.
    private var folds: Binding<Set<FeedRow.ID>> {
        Binding(
            get: { Self.folds(unfolded, of: reading, opening: opensUnfolded) },
            set: { unfolded = FeedFact(reading: reading, value: $0) },
        )
    }

    /// The folds the reader made in THIS reading, or what it opens on. Out of the binding so a
    /// suite can ask it: a fold is a row position, so folds carried into another Session unfold
    /// whatever now sits where they were.
    static func folds(
        _ held: FeedFact<Set<FeedRow.ID>>?,
        of reading: FeedReading,
        opening: Set<FeedRow.ID>,
    )
        -> Set<FeedRow.ID> {
        held.flatMap { $0.reading == reading ? $0.value : nil } ?? opening
    }

    /// The row the user's own words just landed on, while the accent wash stands over it.
    @State var washed: FeedRow.ID?
    /// When the wait this reading is showing began, or `nil` while it is showing none. Held here
    /// and not in the row that draws it, because the table recycles cells: a clock kept in a row
    /// would restart every time the reader scrolled it off and back, and a six-minute wait would
    /// come back reading as a fresh one.
    @State private var waitStarted: Date?

    package var body: some View {
        FeedTable(
            reading: reading,
            rows: rows,
            selection: selection,
            held: held,
            isResizing: isResizing,
            isUnderComposer: isUnderComposer,
            washed: washed,
            unfolded: folds,
            handle: table,
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
        // The age of the wait is counted from here. Stamped on the CHANGE, so a row arriving
        // mid-think does not restart a wait that never stopped — and on the reading too, so two
        // Sessions showing the same wait in a row are two waits rather than one that never did.
        .onChange(
            of: FeedFact(reading: reading, value: FeedWait.showing(in: rows)),
            initial: true,
        ) {
            waitStarted = $1.value == nil ? nil : Date()
        }
        .environment(\.argoWaitStarted, waitStarted)
        // Cancellation IS the reset: a second send while the first wash stands re-keys
        // the task, and the fresh one times the fresh row.
        .task(id: washed) { await washExpired() }
        // On the reading and NOT on the view: the way-back control and the empty-feed word float
        // over this and must never fade with it.
        .mask { fade }
        .overlay(alignment: .bottomTrailing) { tail }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if rows.isEmpty {
                // Centred in what the canopy leaves: this word does not scroll, so it cannot use
                // the table's inset the way the rows do.
                FeedSilence()
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
                .padding(
                    .bottom,
                    isUnderComposer ? ArgoComposerVessel.feedClearance : ArgoFeedRow.tailLift,
                )
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
        isUnderComposer: Bool = false,
        table: FeedTableHandle,
        opensUnfolded: Set<FeedRow.ID> = [],
        washed: FeedRow.ID? = nil,
    ) {
        self.reading = reading
        self.rows = rows
        self.selection = selection
        self.held = held
        self.isUnderComposer = isUnderComposer
        self.table = table
        self.opensUnfolded = opensUnfolded
        _washed = State(wrappedValue: washed)
    }
}
