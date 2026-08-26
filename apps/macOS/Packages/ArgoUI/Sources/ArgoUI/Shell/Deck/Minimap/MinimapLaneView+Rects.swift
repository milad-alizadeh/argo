import AppKit

// The banded half of the lane: which slice of the miniature is held as pixels, where that slice is
// put, and when it is drawn again (#658) — now drawing the rows' own shapes (#382).
//
// The whole point of the split is what does NOT happen here. A scroll inside the band moves the
// rects layer and returns; only leaving the band, or the band's own content changing, reaches the
// rasteriser. A hover reaches it never — the annotations are a layer above this one.

extension MinimapLaneView {
    /// The rects layer put where the miniature has slid to, redrawing only when it has to.
    func placeRects(slidTo laneOffset: CGFloat) {
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
        rectsLayer.frame = rect(at: band.origin - laneOffset, height: band.height)
    }

    /// The band rasterised, unless the pixels already there say the same thing. A feed append below
    /// the band leaves its rects untouched, which is why the comparison is on what would be drawn
    /// rather than on the reading.
    private func paint(_ band: MinimapBand) {
        guard let palette else { return }
        let rects = geometry.rects(in: band.range)
        let inks = FeedInk.allCases.map { ink($0, in: palette) }
        guard band != drawnBand || rects != drawnRects || inks != inked else { return }
        rectRedraws += 1
        drawnBand = band
        drawnRects = rects
        inked = inks
        rectsLayer.contentsScale = backingScale
        rectsLayer.contents = bitmap(rects, in: band)
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

    private func bitmap(_ rects: [MinimapRect], in band: MinimapBand) -> CGImage? {
        guard bounds.width > ArgoMinimapLane.rectInset * 2 else { return nil }
        let size = CGSize(width: bounds.width, height: band.height)
        return flipped(size, scale: rectsLayer.contentsScale) { context in
            for rect in rects {
                draw(rect, in: context, of: band)
            }
        }
    }

    /// One rect, in the shape the ROW said it drew. Band-local: the rects count down from the
    /// band's head, and so does the context they are drawn into.
    private func draw(_ rect: MinimapRect, in context: CGContext, of band: MinimapBand) {
        guard let palette else { return }
        let inset = ArgoMinimapLane.rectInset
        let drawable = bounds.width - inset * 2
        let box = CGRect(
            x: inset + rect.span.lowerBound * drawable,
            y: rect.y - band.origin,
            width: (rect.span.upperBound - rect.span.lowerBound) * drawable,
            height: rect.height,
        )
        let ink = ink(rect.ink, in: palette).cgColor
        switch rect.shape {
        case .bar, .rule:
            context.setFillColor(ink)
            context.fill(box)
        // Pulled in by half the stroke so the frame lands inside the slot it was given rather than
        // straddling it — at this scale that is the difference between a frame and a smear.
        case .frame:
            let width = ArgoFeedRow.ruleWidth
            context.setStrokeColor(ink)
            context.setLineWidth(width)
            context.stroke(box.insetBy(dx: width / 2, dy: width / 2))
        }
    }
}
