import CoreGraphics

// What a row reports it drew. Called for the rows inside the lane's band and for no others, so its
// cost is bounded by the lane's height rather than by the session's length.
//
// Nothing here decides where the ROW sits — that is the reading's prefix sum, off the heights the
// feed table measured. Everything here is inside the row.

extension MinimapRowShape {
    /// The rectangles this row draws, in the row's own coordinates, across a drawable `measure`
    /// points wide. `height` is what the feed table measured the row at, which is what the shapes
    /// drawn as a whole row take.
    @MainActor func rects(across measure: CGFloat, height: CGFloat) -> [MinimapRowRect] {
        switch self {
        case let .composed(blocks, ink):
            MinimapProseBlock.rects(of: blocks, ink: ink, across: measure)
        case let .bubble(text, shots, isFolded):
            Self.bubble(text, shots: shots, isFolded: isFolded, across: measure)
        case let .line(parts, ink):
            Self.line(parts, ink: ink, across: measure)
        case let .shots(widths):
            Self.shots(widths, across: measure)
        case let .card(card):
            Self.card(card, across: measure, height: height)
        case let .whole(ink):
            [MinimapRowRect(y: 0, height: height, from: 0, to: measure, ink: ink)]
        }
    }
}

extension MinimapRowShape {
    /// A gallery's thumbnails at the widths the row draws them, wrapped across the measure the way
    /// `FeedGalleryRow` wraps them across the column. Drawn one frame per shot rather than one over
    /// the run, because the count is the whole question a reader has about a turn that rendered
    /// something.
    ///
    /// Through `WrapFlow`'s own arithmetic rather than a grid of its own: with a width per shot
    /// there is no column to count, and a second wrap rule beside the row's is a lane that drifts
    /// from the feed by a line the moment either one is touched.
    static func shots(_ widths: [CGFloat], across measure: CGFloat) -> [MinimapRowRect] {
        let sizes = widths.map { CGSize(width: $0, height: ArgoFeedRow.shotHeight) }
        let gaps = WrapFlow.Gaps(along: ArgoFeedRow.shotGap, between: ArgoFeedRow.shotGap)
        return WrapFlow.placements(of: sizes, in: measure, gaps: gaps).map { place in
            MinimapRowRect(
                y: ArgoFeedRow.shotBreath + place.minY,
                height: place.height,
                from: place.minX,
                to: min(measure, place.maxX),
                ink: .media,
            )
        }
    }
}
