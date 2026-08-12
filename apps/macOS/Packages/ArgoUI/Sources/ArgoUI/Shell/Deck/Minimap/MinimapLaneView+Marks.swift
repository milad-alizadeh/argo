import AppKit

// The banded half of the lane: which slice of the miniature is held as pixels, where that slice is
// put, and when it is drawn again (#658) — now drawing the rows' own shapes (#382).
//
// The whole point of the split is what does NOT happen here. A scroll inside the band moves the
// marks layer and returns; only leaving the band, or the band's own content changing, reaches the
// rasteriser. A hover reaches it never — the annotations are a layer above this one.

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
        let inks = FeedInk.allCases.map { ink($0, in: palette) }
        guard band != drawnBand || marks != drawnMarks || inks != inked else { return }
        markRedraws += 1
        drawnBand = band
        drawnMarks = marks
        inked = inks
        marksLayer.contentsScale = backingScale
        marksLayer.contents = bitmap(marks, in: band)
    }

    /// A run's ink: the feed's own role at the lane's alpha. Under Increased Contrast the shapes
    /// have to clear the surface before they have to sit under the words, so the alpha lifts —
    /// which is also why `paint` compares on this rather than on the palette.
    private func ink(_ ink: FeedInk, in palette: ArgoPalette) -> ArgoColor {
        let alpha = raisesContrast
            ? ArgoMinimapLane.runOpacityRaised
            : ArgoMinimapLane.runOpacity
        return ink.role(in: palette).opacity(alpha)
    }

    private func bitmap(_ marks: [MinimapMark], in band: MinimapBand) -> CGImage? {
        guard bounds.width > ArgoMinimapLane.markInset * 2 else { return nil }
        let size = CGSize(width: bounds.width, height: band.height)
        return flipped(size, scale: marksLayer.contentsScale) { context in
            for mark in marks {
                draw(mark, in: context, of: band)
            }
        }
    }

    /// One run, in the shape its ink carries. Band-local: the marks count down from the band's
    /// head, and so does the context they are drawn into.
    private func draw(_ mark: MinimapMark, in context: CGContext, of band: MinimapBand) {
        guard let palette else { return }
        // The one shape that crosses the whole lane. Everything else stands off both edges,
        // which is what makes a needs-you row findable with the colour taken away.
        let inset = mark.ink.shape == .band ? 0 : ArgoMinimapLane.markInset
        let drawable = bounds.width - inset * 2
        let rect = CGRect(
            x: inset + mark.span.lowerBound * drawable,
            y: mark.y - band.origin,
            width: (mark.span.upperBound - mark.span.lowerBound) * drawable,
            height: mark.height,
        )
        let ink = ink(mark.ink, in: palette).cgColor
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
