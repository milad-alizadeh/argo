import CoreGraphics

/// One pixel of the drawable the map was drawn into (#1153).
///
/// A type rather than a pair of `Int`s, because the pair carries an invariant that a pair cannot:
/// these are DRAWABLE pixels, counted from the top left, and a view's own points are neither. Both
/// conversions live in the one initialiser below, so there is exactly one place the pick's
/// arithmetic can be wrong — and `AtlasPixelTests` is what holds it.
struct AtlasPixel: Equatable {
    let x: Int
    let y: Int

    init(x: Int, y: Int) {
        self.x = x
        self.y = y
    }

    /// The pixel one point of a view names.
    ///
    /// Two conversions, and the whole of what separates a pointer from a texture:
    ///
    /// The SCALE. A drawable is in pixels and a view in points, and the two differ by the backing
    /// scale of the screen this window is on — read off the drawable itself, never off an
    /// `NSScreen`, which need not be that one.
    ///
    /// The Y AXIS. An `NSView` counts up from its bottom left and a texture counts rows down from
    /// its top left. A point spent as it arrives picks the file mirrored about the middle of the
    /// map, which looks plausible from the centre outward and is wrong everywhere.
    init?(_ point: CGPoint, in bounds: CGSize, drawable: CGSize) {
        guard bounds.width > 0, bounds.height > 0 else { return nil }
        self.init(
            x: Int(point.x * drawable.width / bounds.width),
            y: Int((bounds.height - point.y) * drawable.height / bounds.height),
        )
    }
}
