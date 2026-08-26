import SwiftUI

/// `flex-wrap: wrap`, spelled as a `Layout`: items run leading-to-trailing with one gap, and break
/// onto a new line where the measure ends. Each item keeps whatever size it asks for.
///
/// Not a sideways scroller and not a `LazyVGrid` (#572): a nested `NSScrollView` arbitrates every
/// wheel gesture with the reading behind it, and an adaptive grid re-spaces its columns to justify
/// the measure.
struct WrapFlow: Layout {
    var gap: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize, subviews: Subviews, cache _: inout (),
    )
        -> CGSize {
        let width = proposal.width ?? .infinity
        let places = Self.placements(of: sizes(of: subviews), in: width, gap: gap)
        let height = places.map(\.maxY).max() ?? 0
        let widest = places.map(\.maxX).max() ?? 0
        // Never wider than the tiles actually ran. Claiming the whole proposal stretched the one
        // container that HUGS its content — a prompt's bubble, which held a short line of words
        // out at its ceiling behind a single thumbnail (#733).
        return CGSize(width: min(width, widest), height: height)
    }

    func placeSubviews(
        in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout (),
    ) {
        let places = Self.placements(of: sizes(of: subviews), in: bounds.width, gap: gap)
        for (place, view) in zip(places, subviews) {
            view.place(
                at: CGPoint(x: bounds.minX + place.minX, y: bounds.minY + place.minY),
                proposal: ProposedViewSize(place.size),
            )
        }
    }

    /// A tile is asked for its own size — the layout imposes nothing.
    private func sizes(of subviews: Subviews) -> [CGSize] {
        subviews.map { $0.sizeThatFits(.unspecified) }
    }

    /// Every tile's frame, from sizes alone — the arithmetic both passes share, and the part of
    /// the layout a test can hold without a view. A line breaks before any tile that would cross
    /// the measure, never after the first: a tile wider than the whole measure still gets a line.
    nonisolated static func placements(
        of sizes: [CGSize], in width: CGFloat, gap: CGFloat,
    )
        -> [CGRect] {
        var places: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var line: CGFloat = 0
        for size in sizes {
            if x > 0, x + size.width > width {
                x = 0
                y += line + gap
                line = 0
            }
            places.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            x += size.width + gap
            line = max(line, size.height)
        }
        return places
    }
}
