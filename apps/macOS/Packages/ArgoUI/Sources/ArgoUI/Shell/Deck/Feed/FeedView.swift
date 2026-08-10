import SwiftUI

/// The Session's reading, filling the deck's feed zone.
///
/// It takes rows and what the deck has open — no Session, no Hub — so the same view draws a live
/// transcript, a specimen and a preview. What is on screen is what the projection produced, in the
/// order it produced it.
///
/// The scrolling itself is `FeedTable`'s — AppKit's, for the reasons written on it. What stays
/// here is the one behaviour that is a fact about the WHOLE reading rather than about a scroll:
/// whether it is still following the Session, and what was said since the reader left the end.
struct FeedView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Whether a deck seam is being dragged right now — the table degrades its re-measure to
    /// the visible rows for exactly that long.
    @Environment(\.deckIsResizing) private var isResizing

    let rows: [FeedRow]
    /// What the deck has open and where the keyboard is. Owned by the deck, not here: opening a
    /// row resizes the column this view is drawn in, and a picture covers every zone at once.
    let selection: FeedRowSelection
    /// Which row the reading opens HELD at, as though the reader had scrolled up to it.
    ///
    /// A parameter for the reason `open` and `lit` are parameters of the deck: the way-back control
    /// is on screen exactly while the reading has stopped following, and a screenshot cannot
    /// scroll. Without it the two states this control has — bare, and carrying what was said since
    /// — are reachable only by a person with a trackpad, which is a surface nobody ever looks at.
    var held: FeedRow.ID?

    /// Which prompts the reader has unfolded. Held here rather than in the row, because it is a
    /// fact about the READING rather than about the view drawing a row — it has to survive the row
    /// being rebuilt when the projection hands the feed a newer copy of it.
    @State private var unfolded: Set<FeedRow.ID> = []
    /// Whether the reading is still following the Session — see `FeedTail`. Starts wherever the
    /// reading opens: at the end for a live transcript, detached for one opened held.
    ///
    /// A latch on what the READER last did, not a reading of where the content currently is: a
    /// Session appending a row moves the end away from an offset nobody touched, and following
    /// recomputed from that un-follows itself every time it has something new to show.
    @State private var isFollowing: Bool
    /// The last row present when following broke — what the count on the way-back control is taken
    /// from. See `FeedTail.newMessages`. It must not move until the reader is following again — a
    /// place measured from the top of the pane would count what they were already looking at.
    @State private var leftAt: FeedRow.ID?
    /// The table's imperative verbs — see `FeedTableHandle`.
    @State private var table = FeedTableHandle()

    init(rows: [FeedRow], selection: FeedRowSelection, held: FeedRow.ID? = nil) {
        self.rows = rows
        self.selection = selection
        self.held = held
        // A reading that opens held has already left the end, and the end it left is the row it
        // was opened at — both true before the first frame, which is what lets a screenshot show
        // the detached state.
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
            unfolded: $unfolded,
            onReaderScroll: reader(isNowFollowing:),
            handle: table,
        )
        // The deck's own surfaces still hand the keyboard back the old way — by writing a row
        // into the focus space. No row resolves there any more, so the value is translated into
        // the table's focus the moment it appears.
        .onChange(of: selection.focus.wrappedValue) { _, focus in
            guard case let .row(id) = focus else { return }
            table.focus(onto: id)
        }
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

    /// The deck's selection with the keyboard's way home rewired onto the table. A row closing
    /// its own panel from inside a cell cannot ride `FocusState` back — nothing binds `.row`
    /// any more — so the hand-back is the table's own, deterministic rather than a write into a
    /// focus space that resolves it to nothing.
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
                .padding(.bottom, ArgoFeedRow.tailLift)
                .transition(.opacity)
            }
        }
        .argoAnimation(.reveal, value: isFollowing)
    }

    /// A scroll the reader made, reported as the following answer it produced. The count's anchor
    /// is taken on the EDGE and taken fresh each time: leaving the end a second time counts from
    /// that moment, so the badge reads *since you last left the bottom*. Arriving back at the end
    /// clears it, which makes a scroll home worth as much as a click on the control.
    private func reader(isNowFollowing following: Bool) {
        guard following != isFollowing else { return }
        isFollowing = following
        leftAt = following ? nil : rows.last?.id
    }

    /// Back to the newest row, because the reader asked. Animated, since a jump they requested
    /// should show them where it went — except under Reduce Motion, where the whole content of
    /// the change is the movement, so it lands instantly.
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
