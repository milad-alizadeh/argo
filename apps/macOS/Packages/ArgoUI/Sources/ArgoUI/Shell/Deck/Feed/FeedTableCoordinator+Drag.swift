import AppKit

// The reader's hand on an edge, and what the geometry does about it (ADR-0030, Rule 6).
//
// A drag is the one thing that moves the width every row was measured across, and it moves it once
// a frame. Nothing follows it: the reading stays at the width it was measured at, clipped by the
// pane, and the single pass the drag owes runs when the hand lets go — see
// `FeedTableCoordinator.settleAfterResize()`.

extension FeedTableCoordinator {
    /// Whether the reader has hold of an EDGE — the deck's seam or the window's own frame. One
    /// question, because the two are the same fact to the geometry: the width under this frame is a
    /// frame of a drag rather than a width the reader has settled on, so a document measured
    /// against it is one the next frame throws away.
    ///
    /// Three sources, because no one of them sees both hands: the seam arrives as a model flag, the
    /// window's own drag as a pair of AppKit reports, and `inLiveResize` covers a table AppKit is
    /// resizing without having told this coordinator first.
    var isDragging: Bool {
        model?.isResizing == true || isWindowDragging || table?.inLiveResize == true
    }

    /// The window's edge taken up, which freezes the reading.
    func dragBegan() {
        isWindowDragging = true
        noteDrag()
    }

    /// The window's edge let go: the width is a fact again, and the pass the drag deferred runs.
    ///
    /// Asked of the flag rather than done unconditionally, because the table reports the end of a
    /// window drag from two places — AppKit's own, and the table leaving its window, which is the
    /// drag that would otherwise never end (`FeedTableView.viewDidMoveToWindow`).
    func dragEnded() {
        guard isWindowDragging else { return }
        isWindowDragging = false
        noteDrag()
        settleAfterResize()
    }

    /// The table told where the drag now stands: held at the width its rows were measured across
    /// for exactly as long as an edge is in the reader's hand. Letting go applies the size AppKit
    /// asked for meanwhile, which is the frame change the deferred pass is asked from.
    func noteDrag() {
        table?.isFrozen = isDragging
    }
}
