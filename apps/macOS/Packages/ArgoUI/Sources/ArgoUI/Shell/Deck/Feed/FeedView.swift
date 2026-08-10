import SwiftUI

/// The Session's reading, filling the deck's feed zone.
///
/// It takes rows and what the deck has open — no Session, no Hub — so the same view draws a live
/// transcript, a specimen and a preview. What is on screen is what the projection produced, in the
/// order it produced it.
///
/// Two behaviours that only exist at a real session's length live here rather than on a row,
/// because both are facts about the WHOLE reading: whether it is still following the Session, and
/// where the keyboard is in it.
struct FeedView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Whether a deck seam is being dragged right now — see `FeedPlace`.
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
    ///
    /// It stands for BOTH halves of a detached reading at once: the place the reader is holding,
    /// and the end they left. In a live Session those separate — the end is taken when following
    /// breaks and the reader scrolls on from there — but a fixture that is not growing has no
    /// moment between them to render.
    var held: FeedRow.ID?

    /// Which prompts the reader has unfolded. Held here rather than in the row, because it is a
    /// fact about the READING rather than about the view drawing a row — it has to survive the row
    /// being rebuilt when the projection hands the feed a newer copy of it.
    @State private var unfolded: Set<FeedRow.ID> = []
    /// Whether the reading is still following the Session — see `FeedTail`. Starts `true` because
    /// a feed that fits its pane never scrolls and so never reports a geometry: the way-back-down
    /// control would otherwise stand permanently over a reading with nothing below it.
    ///
    /// A latch on what the READER last did, not a reading of where the content currently is: a
    /// Session appending a row moves the end away from an offset nobody touched, and following
    /// recomputed from that un-follows itself every time it has something new to show.
    @State private var isFollowing = true
    /// The three facts a geometry callback writes on every frame. Off the dependency graph, and
    /// deliberately — see `FeedWatch`.
    @State private var watch = FeedWatch()
    /// The row the reader's place is measured from — the topmost one on screen.
    ///
    /// A scroll offset in points is not a place in a reading. Heights are measured now rather than
    /// estimated, but they are still measured AT A WIDTH: a seam moving or the panel taking half
    /// the deck re-wraps every paragraph, so the document a retained offset was taken against is
    /// not the one it would be applied to. A row id survives that because it is not a measurement.
    @State private var anchored: FeedRow.ID?
    /// The last row present when following broke — what the count on the way-back control is taken
    /// from. See `FeedTail.newMessages`.
    ///
    /// A second place and not `anchored`, because the two are different questions. `anchored` is
    /// the TOPMOST row on screen and moves with every scroll a detached reader makes; this one is
    /// the END of the reading at the moment they left it, and it must not move until they are
    /// following again — a badge measured from the top of the pane would count what the reader was
    /// already looking at.
    @State private var leftAt: FeedRow.ID?

    var body: some View {
        ScrollViewReader { scroller in
            reading
                // Read continuously rather than only on a settle, so a reader dragging up off the
                // end stops being followed the moment they leave it and not when they let go.
                .onScrollGeometryChange(for: ScrollGeometry.self) { $0 } action: { _, geometry in
                    moved(to: geometry)
                }
                .onScrollPhaseChange { _, phase, context in
                    reader(reached: phase, in: context.geometry)
                }
                // The newest ROW, not the count: a live transcript's last row also changes as its
                // call is answered, and a feed that only followed arriving rows would stop
                // following halfway through the one being written.
                .onChange(of: rows.last) {
                    guard isFollowing else { return }
                    follow(with: scroller, animated: false)
                }
                // Keyed on the FIRST row because that is what says a reading is a different one:
                // a Session appends, so its opening line is what does not move.
                .task(id: rows.first?.id) { await open(with: scroller) }
                // Arrow keys answer here rather than on the row, so one place decides what "the
                // next row" means. It fires only when a focused descendant left the key unhandled,
                // which is what keeps a reader arrowing inside an open prompt from jumping rows.
                .onMoveCommand { move($0, with: scroller) }
                .overlay(alignment: .bottomTrailing) { tail(with: scroller) }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if rows.isEmpty {
                FeedSilence()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Feed")
    }

    private var reading: some View {
        ScrollView {
            // Eager, and that is the load-bearing choice on this view.
            //
            // A lazy stack hands the scroller an ESTIMATE for every row nobody has drawn, and the
            // scroll offset is points measured against those estimates. Anything that re-lays the
            // column out — a seam moving, the panel taking half of it, prose re-wrapping — throws
            // them away, and the reading slides against a document that is changing shape beneath
            // it. Every scroll-position bug this feed has had is that one fact wearing a different
            // hat, and each was patched at the surface that exposed it.
            //
            // Measured heights cost the whole session's rows at open — ~0.8s for 1,031 rows on a
            // debug build — and buy back a document with a real height: the reader's place survives
            // a remeasure because there is nothing to remeasure, and the minimap has something to
            // be a scale drawing OF.
            VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                // Over the indices rather than over `rows.enumerated()`, which is not free: an
                // enumeration has to be materialised into an array for `ForEach`, and that array
                // is EVERY row in the session, built again on every evaluation of this body — so a
                // body running at drag rate cost a whole session's worth of tuples per frame on
                // top of the rows themselves. A range allocates nothing, and the identity is
                // unchanged —
                // a row's id IS its position, assigned as one by the only thing that makes rows
                // (`FeedProjection.rows`). The scroll target stays the row's own id regardless.
                ForEach(rows.indices, id: \.self) { position in
                    let row = rows[position]
                    FeedRowView(
                        row: row,
                        isExpanded: unfolding(row.id),
                        selection: selection,
                    )
                    .padding(.top, step(before: position))
                    .id(row.id)
                }
                // The gutter under the last row, and the place "back to the newest" aims at.
                FeedTail()
            }
            // What gives the reader's place an identity: the rows are the scroll targets, and the
            // position below is one of them rather than a number of points into an estimate.
            .scrollTargetLayout()
            .padding(.horizontal, ArgoFeedRow.inset)
            .padding(.top, ArgoSpacing.section)
            // The column, held to a measure and centred in whatever the seams leave it. A feed is
            // read start to finish, and a line that runs the width of a wide display loses the
            // reader's eye on the way back to the next one — so the deck gets wider and the reading
            // does not. Centred rather than pinned left, because a bounded column against the
            // leading edge reads as a column that failed to fill the space beside it.
            .argoFeedMeasure()
        }
        // Anchored to the TOP row rather than the centre: the top of the pane is where a reader's
        // eye is on a column read downwards, and it is the edge a row growing under them moves
        // least. The tail is in this layout too and is not a row — its own anchor is the scroller's
        // to aim at, and nothing here has to know about it.
        .scrollPosition(id: pin, anchor: .top)
        // The opening offset only, and the half of getting there that does not depend on estimated
        // heights — `open(with:)` is the other.
        .defaultScrollAnchor(.bottom, for: .initialOffset)
        // What holds a FOLLOWING reading still while the column is re-measured.
        //
        // `pin` reports nothing while the reading follows — deliberately, so an arriving row is not
        // fought over by two authorities — which leaves the scroll view holding a raw point offset.
        // That is fine while the content's width is fixed. Under a seam it is not: every paragraph
        // re-wraps on every frame of the drag, so the height those points are measured against is
        // moving, and the reading slides against content that is changing shape beneath it.
        //
        // Answering `.bottom` here is not a second authority over the offset — it is the same claim
        // `isFollowing` already makes, applied to the one event that was moving it. Absent the
        // moment the reader detaches, which is what keeps it from holding a bottom nobody is at.
        .defaultScrollAnchor(isFollowing ? .bottom : nil, for: .sizeChanges)
    }

    /// The held row, reported only once the reader has detached from the end, and writable only
    /// while the column is still. Both rules live in `FeedPlace`, which is where they are tested.
    private var pin: Binding<FeedRow.ID?> {
        FeedPlace.pin($anchored, isFollowing: isFollowing, whileResizing: isResizing)
    }

    /// The way back down, on screen only while the reading has stopped following.
    ///
    /// The reveal is scoped to the button and not to the reading it sits over.
    /// `.animation(_:value:)` animates EVERY pending change in the subtree it is applied to, so
    /// declared over the scroll view it animated the column's own width — and `isFollowing` is
    /// computed from the content height, which a seam drag changes on every frame. A button fading
    /// in was pulling the whole feed through a curve behind it.
    private func tail(with scroller: ScrollViewProxy) -> some View {
        ZStack {
            if !isFollowing, !rows.isEmpty {
                // Nothing to count until the reader has left an end: a reading that is following
                // has no place to count from, and one taken from the end it sits at would count
                // from now.
                FeedTailButton(
                    newMessages: leftAt.map { FeedTail.newMessages(in: rows, since: $0) } ?? 0,
                ) { follow(with: scroller, animated: true) }
                    .padding(.trailing, ArgoFeedRow.inset)
                    .padding(.bottom, ArgoFeedRow.tailLift)
                    .transition(.opacity)
            }
        }
        .argoAnimation(.reveal, value: isFollowing)
    }

    /// Back to the newest row. Unanimated while the Session is writing — a feed that eased into
    /// place once per arriving line would be permanently in motion — and animated when the reader
    /// asked for it, because a jump they requested should show them where it went. That one lands
    /// instantly under Reduce Motion: the whole content of the change is the movement.
    private func follow(with scroller: ScrollViewProxy, animated: Bool) {
        guard !rows.isEmpty else { return }
        // Asserted rather than left to the scroll to demonstrate: this is what disengages the pin,
        // and a reader tapping the way back down has said what they want more plainly than a
        // geometry taken afterwards could.
        isFollowing = true
        anchored = nil
        // Cleared here as well as in the latch, because this is the OTHER way following resumes. A
        // badge left standing over a feed that is following again is a lie the reader has to
        // disprove by scrolling.
        leftAt = nil
        watch.isSelfScrolling = true
        let motion = animated ? ArgoMotion.selection.resolved(reduceMotion: reduceMotion) : nil
        // To the END of the reading rather than to its last row: the gutter under that row is part
        // of the content, and a scroll that stopped at the row would leave the feed permanently a
        // gutter short of the bottom it is trying to sit at.
        withAnimation(motion) { scroller.scrollTo(FeedTail.Anchor.tail, anchor: .bottom) }
        Task {
            await settle()
            watch.isSelfScrolling = false
        }
    }

    /// Onto the newest line of a reading being opened.
    ///
    /// Once. It used to be twice with a layout pass between, because a lazy stack's first scroll
    /// aimed at a height estimated from rows nobody had drawn and landed short of the end; the
    /// stack is eager now, so the height the first scroll aims at is the height the document has.
    private func open(with scroller: ScrollViewProxy) async {
        // Never onto the end of a reading that opened held. `held` says the reader is already
        // somewhere, and this scroll would take them off it before the first frame is drawn.
        guard held == nil else { return await hold(with: scroller) }
        follow(with: scroller, animated: false)
    }

    /// Onto the row a reading opened HELD at — the scroll a specimen cannot make by hand.
    ///
    /// Announced as this view's own scroll for its whole length, which is load-bearing: the reading
    /// starts at the end (`defaultScrollAnchor`), and a geometry read before it has moved would
    /// latch the reader as following and clear the very state this is putting them in.
    ///
    /// Detaching comes last, and in that order for two reasons. `scrollPosition` OWNS the offset
    /// the moment it is bound, and it is bound exactly while the reading is detached — so a scroll
    /// after the flip is quietly swallowed, and the control ends up standing over a reading that
    /// never left the end. And the end the reader left is only true once they have left it.
    private func hold(with scroller: ScrollViewProxy) async {
        guard let held else { return }
        watch.isSelfScrolling = true
        // After a layout pass, never before one: the row has to be IN the document before the
        // scroller can be aimed at it, and on the first pass it is not yet.
        await settle()
        scroller.scrollTo(held, anchor: .top)
        await settle()
        leftAt = held
        isFollowing = false
        watch.isSelfScrolling = false
    }

    /// A layout pass. `Task.yield()` only gives up the scheduler, and the height being waited on is
    /// produced by a draw rather than by another task getting a turn.
    private func settle() async {
        try? await Task.sleep(for: FeedTail.settlingPass)
    }

    /// A geometry the reading arrived at, and whether it says anything about the reader.
    ///
    /// Two witnesses that it was not the feed's own doing, and either will do. The phase says WHO
    /// scrolled, which is the plainer answer where a device reports one — a discrete wheel may
    /// report none at all. The content height says WHAT changed: a reading that grew moved its own
    /// end, and a reader who has not touched anything cannot have left an end that came to them.
    private func moved(to geometry: ScrollGeometry) {
        let grew = geometry.contentSize.height != watch.readingHeight
        guard watch.isReaderScrolling || !(grew || watch.isSelfScrolling) else {
            watch.readingHeight = geometry.contentSize.height
            return
        }
        latch(onto: geometry)
    }

    /// The reader's hand arriving on the reading, and leaving it.
    ///
    /// The final read is taken HERE and not from the last geometry, because a scroll settles after
    /// its last frame: a flick that comes to rest exactly at the end reports its arrival as a phase
    /// and not as a movement, and a latch left on the frame before it would say they stopped short.
    private func reader(reached phase: ScrollPhase, in geometry: ScrollGeometry) {
        let isTheirs = FeedTail.isReaderDriven(phase)
        guard watch.isReaderScrolling || isTheirs else { return }
        watch.isReaderScrolling = isTheirs
        latch(onto: geometry)
    }

    /// Where the reading is, taken as the reader's own position.
    ///
    /// The count's anchor is taken on the EDGE rather than on every geometry, and taken fresh each
    /// time: leaving the end a second time counts from that moment, so the badge always reads
    /// *since you last left the bottom* rather than *since the first time you ever did*. Arriving
    /// back at the end clears it by hand, which is what makes a scroll home worth as much as a
    /// click on the control.
    private func latch(onto geometry: ScrollGeometry) {
        watch.readingHeight = geometry.contentSize.height
        let following = FeedTail.isFollowing(
            offset: geometry.contentOffset.y,
            pane: geometry.containerSize.height,
            reading: geometry.contentSize.height,
        )
        guard following != isFollowing else { return }
        isFollowing = following
        leftAt = following ? nil : rows.last?.id
    }

    /// A run of calls is one piece of work and sits closer together than two things the agent
    /// said. The step lives here rather than on the row because it is a fact about a PAIR of rows,
    /// and a row that padded itself would double the gap wherever two of them met.
    private func step(before position: Int) -> CGFloat {
        guard position > 0 else { return 0 }
        return rows[position - 1].isCall && rows[position].isCall
            ? ArgoFeedRow.callStep
            : ArgoFeedRow.gap
    }

    private func unfolding(_ id: FeedRow.ID) -> Binding<Bool> {
        Binding(
            get: { unfolded.contains(id) },
            set: { isOn in
                if isOn {
                    unfolded.insert(id)
                } else {
                    unfolded.remove(id)
                }
            },
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
