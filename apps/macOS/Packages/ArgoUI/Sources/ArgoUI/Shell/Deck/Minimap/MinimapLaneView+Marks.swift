import AppKit

// The banded half of the lane: which slice of the miniature is held as pixels, where that slice is
// put, and when it is drawn again (#658).
//
// The whole point of the split is what does NOT happen here. A scroll inside the band sets the
// marks layer's frame and returns; only leaving the band, or the band's own content changing,
// reaches the rasteriser.

extension MinimapLaneView {
    /// The marks layer put where the miniature has slid to, redrawing only when it has to.
    func placeMarks(slidTo laneOffset: CGFloat) {
        let window = laneOffset ... laneOffset + bounds.height
        let band = drawnBand.flatMap { $0.covers(window) ? $0 : nil } ?? MinimapBand.around(
            window,
            of: geometry.miniatureHeight,
            reach: bounds.height * ArgoMinimapLane.bandLaneHeights,
        )
        paint(band)
        marksLayer.frame = rect(at: band.origin - laneOffset, height: band.height, inset: 0)
    }

    /// The band rasterised, unless the pixels already there say the same thing. A feed append below
    /// the band leaves its marks untouched, which is why the comparison is on the marks rather than
    /// on the reading.
    private func paint(_ band: MinimapBand) {
        guard let ink = markInk else { return }
        let marks = geometry.marks(in: band.range)
        guard band != drawnBand || marks != drawnMarks || ink != inked else { return }
        markRedraws += 1
        drawnBand = band
        drawnMarks = marks
        inked = ink
        // Two before the view has a window to ask: the lane is only ever built on a Retina Mac,
        // and a wrong guess costs one re-rasterise from `viewDidChangeBackingProperties`.
        marksLayer.contentsScale = window?.backingScaleFactor ?? 2
        marksLayer.contents = bitmap(of: marks, in: band)
    }

    /// The ink is `inked`, which `paint` has just set — one fewer parameter to carry, and the one
    /// caller is right above.
    private func bitmap(of marks: [MinimapMark], in band: MinimapBand) -> CGImage? {
        let inset = ArgoMinimapLane.markInset
        let scale = marksLayer.contentsScale
        guard let ink = inked, bounds.width > inset * 2, band.height > 0,
              let context = CGContext(
                  data: nil,
                  width: Int(bounds.width * scale),
                  height: Int(band.height * scale),
                  bitsPerComponent: 8,
                  bytesPerRow: 0,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue,
              )
        else {
            return nil
        }
        context.scaleBy(x: scale, y: scale)
        context.setFillColor(ink.cgColor)
        for mark in marks {
            // Band-local, and flipped: the marks count down from the band's head, the context up.
            context.fill(CGRect(
                x: inset,
                y: band.height - (mark.y - band.origin) - mark.height,
                width: bounds.width - inset * 2,
                height: mark.height,
            ))
        }
        return context.makeImage()
    }
}
