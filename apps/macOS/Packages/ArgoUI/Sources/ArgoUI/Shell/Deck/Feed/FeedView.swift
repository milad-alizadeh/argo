import SwiftUI

/// The Session's reading, filling the deck's feed zone. It takes rows and what the deck has open —
/// no Session, no Hub — so the same view draws a live transcript, a specimen and a preview.
///
/// The scrolling itself is `FeedTable`'s (AppKit's). What stays here is whether the reading is
/// still following the Session, and what was said since the reader left the end.
struct FeedView: View {
    @Environment(\.argo) private var argo
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Whether a deck seam is being dragged — the table degrades its re-measure to the visible rows
    /// for exactly that long.
    @Environment(\.deckIsResizing) private var isResizing

    let rows: [FeedRow]
    /// What the deck has open and where the keyboard is. Owned by the deck: opening a row resizes
    /// the column this view is drawn in.
    let selection: FeedRowSelection
    /// Which row the reading opens HELD at, as though the reader had scrolled up to it. A parameter
    /// because a screenshot cannot scroll, and the detached state is otherwise unreachable.
    var held: FeedRow.ID?
    /// Whether the composer floats over this reading. It decides the gutter at the end
    /// (`FeedTail`), the fade that lets rows run under the vessel, and how far the way-back control
    /// lifts — all three being one fact about the column's bottom edge.
    var isUnderComposer = false

    /// Which prompts the reader has unfolded. Held here so it survives the row being rebuilt when
    /// the projection hands the feed a newer copy of it.
    @State private var unfolded: Set<FeedRow.ID> = []
    /// Whether the reading is still following the Session — see `FeedTail`. Starts at the end for a
    /// live transcript, detached for one opened held.
    ///
    /// A latch on what the READER last did, not a reading of where the content currently is: a
    /// Session appending a row moves the end away from an offset nobody touched, and following
    /// recomputed from that un-follows itself every time it has something new to show.
    @State private var isFollowing: Bool
    /// The last row present when following broke — what `FeedTail.newMessages` counts from. It must
    /// not move until the reader is following again.
    @State private var leftAt: FeedRow.ID?
    /// The row the user's own words just landed on, while the accent wash stands over it.
    @State var washed: FeedRow.ID?
    /// The table's imperative verbs — see `FeedTableHandle`.
    @State private var table = FeedTableHandle()
    /// When the wait this reading is showing began, or `nil` while it is showing none. Held here
    /// and not in the row that draws it, because the table recycles cells: a clock kept in a row
    /// would restart every time the reader scrolled it off and back, and a six-minute wait would
    /// come back reading as a fresh one.
    @State private var waitStarted: Date?

    init(
        rows: [FeedRow],
        selection: FeedRowSelection,
        held: FeedRow.ID? = nil,
        isUnderComposer: Bool = false,
    ) {
        self.rows = rows
        self.selection = selection
        self.held = held
        self.isUnderComposer = isUnderComposer
        // Both true before the first frame, which is what lets a screenshot show the detached
        // state: a reading that opens held has already left the end, at the row it opened at.
        _isFollowing = State(initialValue: held == nil)
        _leftAt = State(initialValue: held)
    }

    var body: some View {
        FeedTable(
            rows: rows,
            selection: routed,
            held: held,
            isFollowing: isFollowing,
            isResizing: isResizing,
            isUnderComposer: isUnderComposer,
            washed: washed,
            unfolded: $unfolded,
            onReaderScroll: reader(isNowFollowing:),
            handle: table,
        )
        // The deck's own surfaces hand the keyboard back by writing a row into the focus space. No
        // row resolves there any more, so the value is translated into the table's focus on sight.
        .onChange(of: selection.focus.wrappedValue) { _, focus in
            guard case let .row(id) = focus else { return }
            table.focus(onto: id)
        }
        .onChange(of: rows.count) { was, now in
            washArrived(between: was, and: now)
        }
        // The age of the wait is counted from here. Stamped on the CHANGE, so a row arriving
        // mid-think does not restart a wait that never stopped.
        .onChange(of: FeedWait.showing(in: rows), initial: true) { _, wait in
            waitStarted = wait == nil ? nil : Date()
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
                FeedSilence()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Feed")
    }

    /// The deck's selection with the keyboard's way home rewired onto the table. A row closing its
    /// own panel from inside a cell cannot ride `FocusState` back — nothing binds `.row` any more.
    private var routed: FeedRowSelection {
        var routed = selection
        routed.homeward = { [table] id in table.focus(onto: id) }
        return routed
    }

    /// The way back down, on screen only while the reading has stopped following.
    private var tail: some View {
        ZStack {
            if !isFollowing, !rows.isEmpty {
                FeedTailButton(
                    newMessages: leftAt.map { FeedTail.newMessages(in: rows, since: $0) } ?? 0,
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
        .argoAnimation(.reveal, value: isFollowing)
    }

    /// A scroll the reader made, reported as the following answer it produced. The count's anchor
    /// is
    /// taken on the EDGE and taken fresh each time, so the badge reads *since you last left the
    /// bottom*; arriving back at the end clears it.
    private func reader(isNowFollowing following: Bool) {
        guard following != isFollowing else { return }
        isFollowing = following
        leftAt = following ? nil : rows.last?.id
    }

    /// Back to the newest row, because the reader asked. Animated — except under Reduce Motion,
    /// where the whole content of the change is the movement, so it lands instantly.
    private func follow() {
        isFollowing = true
        leftAt = nil
        table.follow(
            over: reduceMotion ? ArgoMotion.selection.reducedDuration : ArgoMotion.selection
                .duration,
        )
    }
}

#Preview("Feed — a turn read from a transcript") {
    FeedPreview(rows: FeedProjection.previewRows)
        .frame(width: 820, height: 560)
}

#Preview("Feed — a deck wide enough to break the measure") {
    FeedPreview(rows: FeedProjection.previewRows)
        .frame(width: 1440, height: 560)
}

#Preview("Feed — a Session that has said nothing") {
    FeedPreview(rows: [])
        .frame(width: 820, height: 320)
}

#Preview("Feed — a real session's worth of rows") {
    FeedPreview(rows: FeedProjection.longRows)
        .frame(width: 820, height: 560)
}
