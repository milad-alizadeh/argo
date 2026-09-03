import AppKit

// Where a row's height comes from now: the settled document, and nowhere else (ADR-0030, Rule 3).
//
// There is no measuring on this path any more. A height AppKit asks for was worked out or typeset
// by `FeedMeasurePass`, off the main actor, before the table was shown a single row — which is the
// whole of what "the geometry never changes under the scroller" means. The store in front of it is
// `FeedGeometry`, which is what lets a document outlive the table that opened on it (#858).

extension FeedTableCoordinator {
    /// A row's height, off the settled document.
    ///
    /// The estimate is unreachable in the shipped path and is not a fallback: the table draws no
    /// row until a document stands (`show(_:against:freshly:on:)`), so an index this document does
    /// not hold is an index no row exists at. It is here because `NSTableView` takes a `CGFloat`
    /// and there is nothing honest to return for a row that is not there.
    func measuredHeight(at index: Int, in _: NSTableView) -> CGFloat {
        askedHeight()
        return geometry.height(at: index) ?? Self.estimatedRowHeight
    }
}
