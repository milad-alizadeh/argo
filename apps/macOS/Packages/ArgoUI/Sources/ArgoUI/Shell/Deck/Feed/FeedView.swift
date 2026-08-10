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
    @Environment(\.argo) private var argo
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
    /// Whether the composer floats over this reading. It decides three things at once — the
    /// gutter at the end (`FeedTail`), the fade that lets rows run under the vessel, and how far
    /// the way-back control lifts — because all three are one fact about the column's bottom edge.
    var isUnderComposer = false

    /// Which prompts the reader has unfolded. Held here rather than in the row: the stack is lazy,
    /// so a row's own state dies the moment it scrolls out of view.
    @State var unfolded: Set<FeedRow.ID> = []
    /// Whether the reading is still following the Session — see `FeedTail`. Starts `true` because
    /// a feed that fits its pane never scrolls and so never reports a geometry: the way-back-down
    /// control would otherwise stand permanently over a reading with nothing below it.
    ///
    /// A latch on what the READER last did, not a reading of where the content currently is: a
    /// Session appending a row moves the end away from an offset nobody touched, and following
    /// recomputed from that un-follows itself every time it has something new to show.
    @State private var isFollowing = true
    /// Whether the reader's hand is on the reading right now — see `FeedTail.isReaderDriven`.
    @State private var isReaderScrolling = false
    /// Whether a scroll this view asked for is still in flight. It lands short against estimated
    /// heights, so a geometry read during one puts the reader off an end they are being taken to.
    @State private var isSelfScrolling = false
    /// The content height the last geometry carried. What tells a reading that GREW from one the
    /// reader moved through, when no scroll phase does — the two arrive as the same callback.
    @State private var readingHeight: CGFloat = 0
    /// The row the reader's place is measured from — the topmost one on screen.
    ///
    /// A scroll offset in points is not a place in a reading. The stack is lazy, so the height of
    /// every row nobody has drawn is an estimate, and anything that re-lays the column out — a seam
    /// moving, the panel taking half of it — throws those estimates away. A retained offset then
    /// points at a different part of the record, or past the end of it, which is the reading
    /// jumping and the column standing blank. A row id survives a remeasure because it is not a
    /// measurement.
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
    /// The row the user's own words just landed on, while the accent wash stands over it. The
    /// echo is the acceptance — no toast — and the wash is what marks the echo as new.
    @State var washed: FeedRow.ID?

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
                .onChange(of: rows.count) { was, now in
                    washArrived(between: was, and: now)
                }
                // Cancellation IS the reset: a second send while the first wash stands re-keys
                // the task, and the fresh one times the fresh row.
                .task(id: washed) { await washExpired() }
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
            LazyVStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                // Over the indices rather than over `rows.enumerated()`, which is not free: an
                // enumeration has to be materialised into an array for `ForEach`, and that array
                // is EVERY row in the session, built again on every evaluation of this body. The
                // stack below is lazy about what it draws; the pairing above it was eager about
                // what it allocated, so a body running at drag rate cost a whole session's worth
                // of rows per frame. A range allocates nothing, and the identity is unchanged —
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
                    .background {
                        if washed == row.id {
                            RoundedRectangle(cornerRadius: ArgoRadius.control)
                                .fill(argo.color.state.muted(argo.color.interaction.accent))
                        }
                    }
                    .argoAnimation(.bloom, value: washed == row.id)
                    .id(row.id)
                }
                // The gutter under the last row, and the place "back to the newest" aims at.
                FeedTail(isUnderComposer: isUnderComposer)
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
        // heights — `open(with:)` is the other. Not `.sizeChanges`, which would hold the bottom
        // against a reader who scrolled away from it; that is `isFollowing`'s question.
        .defaultScrollAnchor(.bottom, for: .initialOffset)
        // On the reading and NOT on the view: the way-back control and the empty-feed word float
        // over this and must never fade with it.
        .mask { fade }
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
                    // Lifted clear of the vessel when one floats there: a way back standing on
                    // the composer is a control on a control.
                    .padding(
                        .bottom,
                        isUnderComposer ? ArgoComposerVessel.feedClearance : ArgoFeedRow.tailLift,
                    )
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
        isSelfScrolling = true
        let motion = animated ? ArgoMotion.selection.resolved(reduceMotion: reduceMotion) : nil
        // To the END of the reading rather than to its last row: the gutter under that row is part
        // of the content, and a scroll that stopped at the row would leave the feed permanently a
        // gutter short of the bottom it is trying to sit at.
        withAnimation(motion) { scroller.scrollTo(FeedTail.Anchor.tail, anchor: .bottom) }
        Task {
            await settle()
            isSelfScrolling = false
        }
    }

    /// Onto the newest line of a reading being opened.
    ///
    /// Twice, with a layout pass between. `LazyVStack` gives the scroll view an ESTIMATED height
    /// for every row nobody has drawn, so the first scroll aims at a number wrong by whatever the
    /// rows it realises on the way turn out to measure; the second aims at the height the first
    /// one settled, and that one is the newest line.
    private func open(with scroller: ScrollViewProxy) async {
        // Never onto the end of a reading that opened held. `held` says the reader is already
        // somewhere, and this scroll would take them off it before the first frame is drawn.
        guard held == nil else { return await hold(with: scroller) }
        follow(with: scroller, animated: false)
        await settle()
        // Not over a reader who got there first. A layout pass is brief, but a scroll inside one is
        // still theirs, and #427's claim does not have an exemption for the first frames of a feed.
        guard isFollowing, !Task.isCancelled else { return }
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
        isSelfScrolling = true
        // After a layout pass, never before one: a lazy stack has no measured height for a row far
        // above the fold, and a scroll aimed at one during the first pass lands nowhere.
        await settle()
        scroller.scrollTo(held, anchor: .top)
        await settle()
        leftAt = held
        isFollowing = false
        isSelfScrolling = false
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
        let grew = geometry.contentSize.height != readingHeight
        guard isReaderScrolling || !(grew || isSelfScrolling) else {
            readingHeight = geometry.contentSize.height
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
        guard isReaderScrolling || isTheirs else { return }
        isReaderScrolling = isTheirs
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
        readingHeight = geometry.contentSize.height
        let following = FeedTail.isFollowing(
            offset: geometry.contentOffset.y,
            pane: geometry.containerSize.height,
            reading: geometry.contentSize.height,
        )
        guard following != isFollowing else { return }
        isFollowing = following
        leftAt = following ? nil : rows.last?.id
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
