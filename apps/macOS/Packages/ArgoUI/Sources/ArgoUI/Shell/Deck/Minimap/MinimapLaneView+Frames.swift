import AppKit

// Where the lane's two layers currently stand — read by the suites that ask what MOVED rather than
// what was drawn, which is the whole of how a compositor move is told from a repaint (#402).

extension MinimapLaneView {
    /// Where the viewport rectangle is drawn — the lane's one moving part.
    var viewportFrame: CGRect {
        viewportLayer.frame
    }

    /// Where the rects bitmap currently sits, band and all.
    var rectsFrame: CGRect {
        rectsLayer.frame
    }

    /// Whether the rects are held inside the lane while the annotations are let OUT of it. Both
    /// halves at once, because that is the claim: the band may not paint over the deck around it,
    /// and a Turn's label must still reach the reading beside it.
    var clipsRectsOnly: Bool {
        rectsClip.masksToBounds && layer?.masksToBounds == false
    }
}
