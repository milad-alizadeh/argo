import SwiftUI

/// `flex-wrap: wrap`, spelled as a `Layout`: items run leading-to-trailing with one gap, and break
/// onto a new line where the measure ends. Each item keeps whatever size it asks for.
///
/// A layout and not a sideways scroller, which is why both of its callers want it. A run that
/// scrolls hides its tail behind an affordance: in the feed's gallery an `NSScrollView` had to
/// arbitrate every wheel gesture with the reading behind it, and in the composer's standing-allow
/// tray a chip past the edge would be a grant the user cannot find — which is the whole of what
/// #572 is about. Not a `LazyVGrid` either: an adaptive grid re-spaces its columns to justify the
/// measure, and these items keep their own size and their own gap wherever the line breaks.
///
/// It lives above both features rather than inside either: it knows nothing about shots or chips,
/// and a shared layout named for one caller reads as the wrong thing at the other.
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
        return CGSize(width: width.isFinite ? width : widest, height: height)
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
