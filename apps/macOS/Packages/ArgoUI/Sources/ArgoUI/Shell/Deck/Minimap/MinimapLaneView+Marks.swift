import AppKit

// The banded half of the lane: which slice of the miniature is held as pixels, where that slice is
// put, and when it is drawn again (#658) — now drawing the rows' own shapes and the Ion Blue line
// beside each Turn (#382).
//
// The whole point of the split is what does NOT happen here. A scroll inside the band sets the
// marks layer's frame and returns; only leaving the band, or the band's own content changing,
// reaches the rasteriser. A hover reaches it never — the labels are a layer above this one.

extension MinimapLaneView {
    /// The marks layer put where the miniature has slid to, redrawing only when it has to.
    func placeMarks(slidTo laneOffset: CGFloat) {
        let window = laneOffset ... laneOffset + bounds.height
        var band = MinimapBand.around(
            window,
            of: geometry.miniatureHeight,
            reach: bounds.height * ArgoMinimapLane.bandLaneHeights,
        )
        if let drawn = drawnBand, drawn.covers(window) {
            band = drawn
        }
        paint(band)
        marksLayer.frame = rect(at: band.origin - laneOffset, height: band.height)
    }

    /// The band rasterised, unless the pixels already there say the same thing. A feed append below
    /// the band leaves its marks untouched, which is why the comparison is on what would be drawn
    /// rather than on the reading.
    private func paint(_ band: MinimapBand) {
        guard let palette else { return }
        let marks = geometry.marks(in: band.range)
        let inks = MinimapInk.allCases.map { $0.color(in: palette) }
        guard band != drawnBand || marks != drawnMarks || inks != inked else { return }
        markRedraws += 1
        drawnBand = band
        drawnMarks = marks
        inked = inks
        // Two before the view has a window to ask: the lane is only ever built on a Retina Mac,
        // and a wrong guess costs one re-rasterise from `viewDidChangeBackingProperties`.
        marksLayer.contentsScale = window?.backingScaleFactor ?? 2
        marksLayer.contents = bitmap(of: band)
    }

    private func bitmap(of band: MinimapBand) -> CGImage? {
        let scale = marksLayer.contentsScale
        guard bounds.width > ArgoMinimapLane.markInset * 2, band.height > 0,
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
        for mark in drawnMarks {
            draw(mark, in: context, of: band)
        }
        return context.makeImage()
    }

    /// One run, in the shape its ink carries. Band-local, and flipped: the marks count down from
    /// the band's head, the context up.
    private func draw(_ mark: MinimapMark, in context: CGContext, of band: MinimapBand) {
        guard let palette else { return }
        // The one shape that crosses the whole lane. Everything else stands off both edges, which
        // is what makes a needs-you row findable with the colour taken away.
        let inset = mark.ink.shape == .band ? 0 : ArgoMinimapLane.markInset
        let drawable = bounds.width - inset * 2
        let rect = CGRect(
            x: inset + mark.span.lowerBound * drawable,
            y: band.height - (mark.y - band.origin) - mark.height,
            width: (mark.span.upperBound - mark.span.lowerBound) * drawable,
            height: mark.height,
        )
        let ink = mark.ink.color(in: palette).cgColor
        switch mark.ink.shape {
        case .bar, .band, .rule:
            context.setFillColor(ink)
            context.fill(rect)
        // Pulled in by half the stroke so the frame lands inside the slot it was given rather than
        // straddling it — at this scale that is the difference between a frame and a smear.
        case .frame:
            let width = ArgoFeedRow.ruleWidth
            context.setStrokeColor(ink)
            context.setLineWidth(width)
            context.stroke(rect.insetBy(dx: width / 2, dy: width / 2))
        }
    }
}
