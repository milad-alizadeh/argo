import CoreGraphics

/// Where the reading lands, and what has to be re-measured to put it there. One owner for both, so
/// the five places that used to answer it cannot disagree (#473, #476, #477).
///
/// A value with no window, no scroll view and no table: `FeedTableCoordinator` is the adapter that
/// executes a decision against AppKit, and holds nothing but AppKit facts.
///
/// Three words this module owns:
///
/// - **following** — a latch on what the READER last did, not a reading of where the content is.
///   A Session appending a row moves the end away from an offset nobody touched.
/// - **left at** — the last row present when following broke. What the new-message count is taken
///   from, and it must not move until the reader is following again.
/// - **the opening** — the scroll a fresh reading gets. Owed until it has been made, live until a
///   reader's own scroll retires it. An open must never out-scroll a hand.
struct FeedScrollPolicy {
    private(set) var isFollowing: Bool
    private(set) var leftAt: FeedRow.ID?
    /// Whether the opening scroll is still owed — what tells the adapter to start a pass run.
    var isOpeningOwed: Bool {
        !hasPlaced && !rows.isEmpty
    }

    private var rows: [FeedRow] = []
    /// The pane width last laid out against — what tells a re-wrap from a plain height change.
    private var paneWidth: CGFloat = 0
    private var hasPlaced = false
    private var isOpeningLive = true

    /// Seeded with the row the reading opens held at: a reading that opens held has already left
    /// the end, at the row it opened at, and both facts have to be true before the first frame.
    init(held: FeedRow.ID? = nil) {
        self.isFollowing = held == nil
        self.leftAt = held
    }

    mutating func resolve(_ event: FeedScrollEvent) -> FeedScrollDecision {
        switch event {
        case let .rowsChanged(stale, fresh):
            rowsChanged(from: stale, to: fresh)
        case let .readingOpened(held):
            readingOpened(held: held)
        case let .readerScrolled(offset, pane, reading):
            readerScrolled(offset: offset, pane: pane, reading: reading)
        case let .paneChanged(width, _, anchor):
            paneChanged(width: width, anchor: anchor)
        case let .resizeEnded(anchor):
            FeedScrollDecision(landing: landing(on: anchor), remeasure: .all)
        case let .settleElapsed(stillLive, anchor):
            settleElapsed(stillLive: stillLive, anchor: anchor)
        case .followRequested:
            followRequested()
        }
    }

    private mutating func rowsChanged(
        from stale: [FeedRow],
        to fresh: [FeedRow],
    )
        -> FeedScrollDecision {
        let delta = FeedTableDelta.between(stale, and: fresh)
        rows = fresh
        // A reading that empties owes its opening again, so the same view opening a fresh record
        // opens it at the end.
        if fresh.isEmpty {
            hasPlaced = false
            isOpeningLive = true
        }
        return FeedScrollDecision(
            landing: isFollowing ? .end : .stay,
            remeasure: delta == .reload ? .rebuild : .none,
            delta: delta,
        )
    }

    private mutating func readingOpened(held: FeedRow.ID?) -> FeedScrollDecision {
        guard !rows.isEmpty, isOpeningLive else { return .stay }
        hasPlaced = true
        return FeedScrollDecision(landing: held.map { .row($0, into: 0) } ?? .end)
    }

    private mutating func readerScrolled(
        offset: CGFloat,
        pane: CGFloat,
        reading: CGFloat,
    )
        -> FeedScrollDecision {
        isOpeningLive = false
        let following = FeedTail.isFollowing(offset: offset, pane: pane, reading: reading)
        guard following != isFollowing else { return .stay }
        isFollowing = following
        // Taken on the EDGE and taken fresh, so the badge reads *since you last left the end*.
        leftAt = following ? nil : rows.last?.id
        return .stay
    }

    private mutating func paneChanged(width: CGFloat, anchor: FeedAnchor?) -> FeedScrollDecision {
        let known = paneWidth
        paneWidth = width
        guard width != known, width > 0, !rows.isEmpty else {
            return FeedScrollDecision(landing: isFollowing ? .end : .stay)
        }
        // The FIRST real width. Rows created before layout had no width to measure against, and
        // the cells carry those estimates; left alone every row stands at the estimate forever.
        guard known > 0 else {
            return FeedScrollDecision(landing: isFollowing ? .end : .stay, remeasure: .rebuild)
        }
        // Degraded first, squared up later. Never trusting a resize flag alone: only the seam's own
        // drag carries one, while a panel's reveal ANIMATES the width with no flag at all.
        return FeedScrollDecision(
            landing: landing(on: anchor),
            remeasure: .visible,
            settle: .whenQuiet,
        )
    }

    /// A hand pauses mid-drag longer than any debounce, and a full re-measure fired into that pause
    /// lands UNDER the hand as hundreds of milliseconds of freeze. So a live drag defers again.
    private func settleElapsed(stillLive: Bool, anchor: FeedAnchor?) -> FeedScrollDecision {
        guard !stillLive else { return FeedScrollDecision(landing: .stay, settle: .whenQuiet) }
        return FeedScrollDecision(landing: landing(on: anchor), remeasure: .all)
    }

    private mutating func followRequested() -> FeedScrollDecision {
        isFollowing = true
        leftAt = nil
        return FeedScrollDecision(landing: .end)
    }

    /// The end while following, the row under the reader's eye when not.
    ///
    /// A detached reader whose row AppKit could not name is left where they are rather than sent to
    /// the end, because the end is the one place a reader who scrolled up did not ask to be.
    private func landing(on anchor: FeedAnchor?) -> FeedLanding {
        guard !isFollowing else { return .end }
        guard let anchor else { return .stay }
        return .row(anchor.row, into: anchor.into)
    }
}
