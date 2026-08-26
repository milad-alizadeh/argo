import Foundation

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
        case let .shots(count):
            Self.shots(count, across: measure)
        case let .card(card):
            Self.card(card, across: measure, height: height)
        case let .whole(ink):
            [MinimapRowRect(y: 0, height: height, from: 0, to: measure, ink: ink)]
        }
    }
}

extension MinimapRowShape {
    /// A gallery's thumbnails, wrapped across the measure the way `FeedGalleryRow` wraps them
    /// across the column. Drawn one frame per shot rather than one over the run, because the count
    /// is the whole question a reader has about a turn that rendered something.
    static func shots(_ count: Int, across measure: CGFloat) -> [MinimapRowRect] {
        let step = ArgoFeedRow.shotWidth + ArgoFeedRow.shotGap
        let columns = max(1, Int((max(measure, 1) + ArgoFeedRow.shotGap) / step))
        return (0 ..< max(0, count)).map { shot in
            let x = CGFloat(shot % columns) * step
            return MinimapRowRect(
                y: ArgoFeedRow.shotBreath
                    + CGFloat(shot / columns) * (ArgoFeedRow.shotHeight + ArgoFeedRow.shotGap),
                height: ArgoFeedRow.shotHeight,
                from: x,
                to: min(measure, x + ArgoFeedRow.shotWidth),
                ink: .media,
            )
        }
    }
}
