import CoreGraphics

// The words the feed's scroll policy speaks in — what it is told, and what it answers. Values
// only, so the whole vocabulary is checkable without a window. The rules are `FeedScrollPolicy`'s.

/// Something that happened to the reading. Every reason the reading might move is one of these.
enum FeedScrollEvent {
    /// A fresh reading arrived. The policy diffs it itself — see `FeedTableDelta`.
    case rowsChanged(from: [FeedRow], to: [FeedRow])
    /// One pass of the scroll a fresh reading gets, at the row it opens held at.
    case readingOpened(held: FeedRow.ID?)
    /// The reader moved the reading — by wheel, flick, key or overview lane.
    case readerScrolled(offset: CGFloat, pane: CGFloat, reading: CGFloat)
    /// The pane changed shape. One raw notification: which of the three width cases it is, is the
    /// policy's to decide, because the policy is what holds the width last laid out against.
    case paneChanged(width: CGFloat, height: CGFloat, anchor: FeedAnchor?)
    /// The seam or the window let go, so the width is a fact rather than a frame of a drag.
    case resizeEnded(anchor: FeedAnchor?)
    /// The wait for a width burst to go quiet elapsed. `stillLive` is the adapter's reading of a
    /// live drag — the model's resize flag or the table's own live-resize state, whichever is true.
    case settleElapsed(stillLive: Bool, anchor: FeedAnchor?)
    /// A batch of the chunked full re-measure landed, with where the reading sits now. Its own
    /// event because rows above the reader change height as they are measured, and the reading has
    /// to be put back after each batch (#856).
    case rowsMeasured(anchor: FeedAnchor?)
    /// The way-back control.
    case followRequested
}

/// The row under the reader's eye and how far the reading has scrolled into it. Only AppKit can
/// answer it, so it is pushed in; a row id and not an index, because an id survives a re-measure
/// (#476).
struct FeedAnchor: Equatable {
    let row: FeedRow.ID
    let into: CGFloat
}

/// Where the reading is to sit after the event.
enum FeedLanding: Equatable {
    case end
    case row(FeedRow.ID, into: CGFloat)
    case stay
}

/// Which rows are to be measured again, and whether their cells survive it.
///
/// `all` and `rebuild` are distinct on purpose: `all` re-measures every row and keeps the cells,
/// `rebuild` also tears them down. Only the first real width earns a rebuild, where the cells were
/// built against no width at all.
enum FeedRemeasure: Equatable {
    case none
    case visible
    case all
    case rebuild

    /// Whether the pass asks AppKit for its heights now rather than at the next layout.
    ///
    /// Only the full settled pass does, and it is reached from a notification only through the
    /// 250ms settle timer. Everything else — a per-frame width, and the reload the first real
    /// width earns — leaves the layout to the pass that was going to happen anyway (#955).
    var forcesLayout: Bool {
        switch self {
        case .none, .visible, .rebuild: false
        case .all: true
        }
    }
}

/// Whether a second, later re-measure is wanted — a mid-drag change wants one now and one when the
/// hand stops. The timer and the live-drag check are the adapter's.
enum FeedSettle: Equatable {
    case none
    case whenQuiet
}

/// What the policy answers. Three axes because neither predicts the other: both a full and a
/// visible-only re-measure pair with landing at the end and with landing on the anchor.
struct FeedScrollDecision: Equatable {
    let landing: FeedLanding
    let remeasure: FeedRemeasure
    let settle: FeedSettle
    /// How the fresh reading differs from the shown one, when the event carried one. The row
    /// insertion itself stays adapter work.
    let delta: FeedTableDelta?

    init(
        landing: FeedLanding,
        remeasure: FeedRemeasure = .none,
        settle: FeedSettle = .none,
        delta: FeedTableDelta? = nil,
    ) {
        self.landing = landing
        self.remeasure = remeasure
        self.settle = settle
        self.delta = delta
    }

    /// The reading is left where it is, and nothing is re-measured.
    static let stay = FeedScrollDecision(landing: .stay)
}
