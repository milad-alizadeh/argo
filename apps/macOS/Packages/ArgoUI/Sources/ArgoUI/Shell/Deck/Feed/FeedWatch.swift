import Foundation

/// What the feed noticed happen, held OFF the view's dependency graph.
///
/// Every one of these is written from a scroll geometry callback, which runs on every frame of
/// every scroll and every frame of a seam drag. None of them is read by `body` — they exist only
/// to tell the next callback apart from the last one. Held as `@State` they invalidated the view
/// anyway, three times a frame, and the invalidation re-laid the column out, and re-laying the
/// column out produced another geometry: `<OnScrollGeometryChange Modifier> tried to update
/// multiple times per frame`, and the reading shaking under the reader's hand.
///
/// A class, so `@State` holds a reference and mutating a property is not a change to the value the
/// view is watching. The loop is broken by the writes not being observed rather than by any of
/// them being made less often — they all still happen, and every one of them is still true.
@MainActor final class FeedWatch {
    /// The content height the last geometry carried. What tells a reading that GREW from one the
    /// reader moved through, when no scroll phase does — the two arrive as the same callback.
    var readingHeight: CGFloat = 0
    /// Whether the reader's hand is on the reading right now — see `FeedTail.isReaderDriven`.
    var isReaderScrolling = false
    /// Whether a scroll this view asked for is still in flight. A geometry read mid-flight reports
    /// wherever the scroll has got to, and latching on that puts the reader off an end they are
    /// being taken to.
    var isSelfScrolling = false
}
