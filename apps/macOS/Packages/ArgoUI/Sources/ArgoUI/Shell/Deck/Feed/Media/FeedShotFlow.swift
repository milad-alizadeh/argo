import SwiftUI

/// `flex-wrap: wrap`, spelled as a `Layout`: fixed-size tiles run leading-to-trailing with one
/// gap, and break onto a new line where the measure ends.
///
/// A layout and not a sideways scroller. A run that scrolls hides its tail behind an affordance,
/// and an `NSScrollView` nested in the feed's table had to arbitrate every wheel gesture with the
/// reading behind it — a grid that wraps shows every shot and leaves the wheel alone. Not a
/// `LazyVGrid` either: an adaptive grid re-spaces its columns to justify the measure, and these
/// tiles keep their own size and their own gap wherever the line breaks.
struct FeedShotFlow: Layout {
    var gap: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize, subviews: Subviews, cache _: inout (),
    )
        -> CGSize {
        let width = proposal.width ?? .infinity
        let places = placements(for: subviews, in: width)
        let height = places.map(\.maxY).max() ?? 0
        let widest = places.map(\.maxX).max() ?? 0
        return CGSize(width: width.isFinite ? width : widest, height: height)
    }

    func placeSubviews(
        in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout (),
    ) {
        for (place, view) in zip(placements(for: subviews, in: bounds.width), subviews) {
            view.place(
                at: CGPoint(x: bounds.minX + place.minX, y: bounds.minY + place.minY),
                proposal: ProposedViewSize(place.size),
            )
        }
    }

    /// Every tile's frame, measured once and shared by both passes. A tile is asked for its own
    /// size — the layout imposes nothing — and a line breaks before any tile that would cross the
    /// measure, never after the first: a tile wider than the whole measure still gets a line.
    private func placements(for subviews: Subviews, in width: CGFloat) -> [CGRect] {
        var places: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var line: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
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
