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

    let rows: [FeedRow]
    /// What the deck has open and where the keyboard is. Owned by the deck, not here: opening a
    /// row resizes the column this view is drawn in, and a picture covers every zone at once.
    let selection: FeedRowSelection

    /// Which prompts the reader has unfolded. Held here rather than in the row: the stack is lazy,
    /// so a row's own state dies the moment it scrolls out of view.
    @State private var unfolded: Set<FeedRow.ID> = []
    /// Whether the reading is still following the Session — see `FeedTail`. Starts `true` because
    /// a feed that fits its pane never scrolls and so never reports a geometry: the way-back-down
    /// control would otherwise stand permanently over a reading with nothing below it.
    @State private var isFollowing = true
    /// The row the reader's place is measured from — the topmost one on screen.
    ///
    /// A scroll offset in points is not a place in a reading. The stack is lazy, so the height of
    /// every row nobody has drawn is an estimate, and anything that re-lays the column out — a seam
    /// moving, the panel taking half of it — throws those estimates away. A retained offset then
    /// points at a different part of the record, or past the end of it, which is the reading
    /// jumping and the column standing blank. A row id survives a remeasure because it is not a
    /// measurement.
    @State private var anchored: FeedRow.ID?

    var body: some View {
        ScrollViewReader { scroller in
            reading
                .onScrollGeometryChange(for: Bool.self) {
                    FeedTail.isFollowing(
                        offset: $0.contentOffset.y,
                        pane: $0.containerSize.height,
                        reading: $0.contentSize.height,
                    )
                } action: { _, following in isFollowing = following }
                // The newest ROW, not the count: a live transcript's last row also changes as its
                // call is answered, and a feed that only followed arriving rows would stop
                // following halfway through the one being written.
                .onChange(of: rows.last) {
                    guard isFollowing else { return }
                    follow(with: scroller, animated: false)
                }
                // Arrow keys answer here rather than on the row, so one place decides what "the
                // next row" means. It fires only when a focused descendant left the key unhandled,
                // which is what keeps a reader arrowing inside an open prompt from jumping rows.
                .onMoveCommand { move($0, with: scroller) }
                .overlay(alignment: .bottomTrailing) { tail(with: scroller) }
                .argoAnimation(.reveal, value: isFollowing)
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
                ForEach(Array(rows.enumerated()), id: \.element.id) { position, row in
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
        .scrollPosition(id: $anchored, anchor: .top)
        // A feed opens on what is happening NOW. Six hours of a session above the fold is not a
        // starting place — a reader who wants the beginning scrolls to it, and the reader who
        // wants the newest line is everyone else.
        //
        // Deliberately NOT anchored to the bottom on open. A `LazyVStack`'s content height is an
        // estimate until its rows are realised, so an initial bottom anchor lands a long feed near
        // its end rather than at it — and every measure taken off that estimated height is wrong
        // by the rows nobody has scrolled through, which is what decides whether the feed is
        // following. Opening at the start of the reading keeps the two agreeing at every offset.
        // Opening on the newest line wants a mechanism that survives lazy estimation; #427 asked
        // for following and holding position, and this delivers those honestly.
    }

    /// The way back down, on screen only while the reading has stopped following.
    @ViewBuilder private func tail(with scroller: ScrollViewProxy) -> some View {
        if !isFollowing, !rows.isEmpty {
            FeedTailButton { follow(with: scroller, animated: true) }
                .padding(.trailing, ArgoFeedRow.inset)
                .padding(.bottom, ArgoFeedRow.tailLift)
                .transition(.opacity)
        }
    }

    /// Back to the newest row. Unanimated while the Session is writing — a feed that eased into
    /// place once per arriving line would be permanently in motion — and animated when the reader
    /// asked for it, because a jump they requested should show them where it went. That one lands
    /// instantly under Reduce Motion: the whole content of the change is the movement.
    private func follow(with scroller: ScrollViewProxy, animated: Bool) {
        guard !rows.isEmpty else { return }
        // Let the held row go first. A reading that is following has no place to hold — the place
        // IS the end — and an anchor left standing is a second authority over the same offset,
        // pulling back to a row upstream of the line that just arrived.
        anchored = nil
        let motion = animated ? ArgoMotion.selection.resolved(reduceMotion: reduceMotion) : nil
        // To the END of the reading rather than to its last row: the gutter under that row is part
        // of the content, and a scroll that stopped at the row would leave the feed permanently a
        // gutter short of the bottom it is trying to sit at.
        withAnimation(motion) { scroller.scrollTo(FeedTail.Anchor.tail, anchor: .bottom) }
    }

    /// One row up or down, with the row it lands on scrolled into view.
    ///
    /// The scroll is not optional: the stack is lazy, so focus moving to a row below the fold moves
    /// it to a row that has not been laid out — and a keyboard reader whose cursor left the screen
    /// has lost the feed. Left and right belong to whatever the row draws, so they fall through.
    private func move(_ direction: MoveCommandDirection, with scroller: ScrollViewProxy) {
        guard case let .row(current) = selection.focus.wrappedValue,
              let standing = rows.firstIndex(where: { $0.id == current })
        else { return }
        let next = switch direction {
        case .up: standing - 1
        case .down: standing + 1
        case .left, .right: standing
        @unknown default: standing
        }
        guard rows.indices.contains(next), next != standing else { return }
        selection.focus.wrappedValue = .row(rows[next].id)
        scroller.scrollTo(rows[next].id)
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

/// A feed with no row in it. It says so, because a blank zone is indistinguishable from one that
/// failed to draw.
///
/// A claim about this SURFACE and not about the Session: an agent can be busy in kinds this feed
/// does not draw yet, and "nothing said" would be a reading of the record rather than of the feed.
private struct FeedSilence: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing to read yet")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
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
