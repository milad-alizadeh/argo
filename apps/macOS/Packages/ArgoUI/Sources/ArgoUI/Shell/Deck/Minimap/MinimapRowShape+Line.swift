import Foundation
import ProseText

// A row the feed says in one line, drawn as the pieces it says it in — at the widths they measure
// and in the inks they take.
//
// This is where a mutation's `+n −n` stops being a fixed slab at the trailing edge. The row draws
// the counts immediately after what it named, in the mono, as wide as the digits run; so that is
// where the lane draws them, and a one-line change reads narrower than a two-hundred-line one.

extension MinimapRowShape {
    /// The pieces of a single-line row, laid end to end with the feed's own gap between them and
    /// cut off at the measure — the row itself is `lineLimit(1)`, so nothing runs past the column
    /// either.
    @MainActor static func line(
        _ parts: [MinimapLinePart],
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> [MinimapRowRect] {
        var rects: [MinimapRowRect] = []
        var x: CGFloat = 0
        for part in parts where x < measure {
            let to = min(measure, x + part.drawnWidth)
            rects.append(MinimapRowRect(
                y: 0,
                height: ProseFace.body.lineBox,
                from: x,
                to: to,
                ink: part.ink,
            ))
            x = to + ArgoFeedRow.callGap
        }
        return rects.isEmpty
            ? [MinimapRowRect(y: 0, height: ProseFace.body.lineBox, from: 0, to: 0, ink: ink)]
            : rects
    }
}
