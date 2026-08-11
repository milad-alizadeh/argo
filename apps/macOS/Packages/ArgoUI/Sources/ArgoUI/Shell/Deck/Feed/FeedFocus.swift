/// Where the keyboard is, across the whole reading — the feed, the panel it opens, and the picture
/// laid over both.
///
/// One focus space rather than three: handing focus back from the panel to the row that opened it
/// is only expressible if both ends are values in the same enum.
///
/// Held by the deck, for the same reason the deck holds which row is open: opening a row resizes
/// the column it sits in, so the feed is not the surface that owns what happened.
enum FeedFocus: Hashable {
    /// One row of the reading, by its place in the feed.
    case row(FeedRow.ID)
    /// The evidence panel, as a whole. Not per-step: the panel is one region a reader tabs into
    /// and scrolls, and a focus value per patch would make Escape mean something different
    /// depending on how far down it they were.
    case panel
    /// A picture opened over the deck. It takes focus so Escape reaches it — `onExitCommand` only
    /// fires for a view in the responder chain.
    case lightbox
}
