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
    /// Whether the reading is still following the Session — see `FeedTail`. Starts `true`: a feed
    /// opens at what is happening now, and a reader who wants the beginning scrolls to it.
    @State private var isFollowing = true

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
                .onChange(of: rows.last, initial: true) {
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
            }
            .padding(.horizontal, ArgoFeedRow.inset)
            .padding(.vertical, ArgoSpacing.section)
            // The column, held to a measure and centred in whatever the seams leave it. A feed is
            // read start to finish, and a line that runs the width of a wide display loses the
            // reader's eye on the way back to the next one — so the deck gets wider and the reading
            // does not. Centred rather than pinned left, because a bounded column against the
            // leading edge reads as a column that failed to fill the space beside it.
            .argoFeedMeasure()
        }
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
        guard let last = rows.last?.id else { return }
        isFollowing = true
        let motion = animated ? ArgoMotion.selection.resolved(reduceMotion: reduceMotion) : nil
        withAnimation(motion) { scroller.scrollTo(last, anchor: .bottom) }
    }

    /// One row up or down, with the row it lands on scrolled into view.
    ///
    /// The scroll is not optional: the stack is lazy, so focus moving to a row below the fold moves
    /// it to a row that has not been laid out — and a keyboard reader whose cursor left the screen
    /// has lost the feed. Left and right belong to whatever the row draws, so they fall through.
    private func move(_ direction: MoveCommandDirection, with scroller: ScrollViewProxy) {
        guard case let .row(current) = selection.focus.wrappedValue,
              let at = rows.firstIndex(where: { $0.id == current })
        else { return }
        let next = switch direction {
        case .up: at - 1
        case .down: at + 1
        case .left, .right: at
        @unknown default: at
        }
        guard rows.indices.contains(next), next != at else { return }
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
