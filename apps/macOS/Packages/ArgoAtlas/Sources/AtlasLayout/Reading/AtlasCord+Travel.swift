import CoreGraphics

/// Where a length of light has got to, along the cord it is passing through (#1425).
package extension AtlasCord {
    /// The point `share` of the way along the arc, by the curve's own parameter rather than by arc
    /// length. A quadratic is not travelled at a constant speed in its parameter, and it does not
    /// have to be: what the reader reads is light passing through a cord, not a lap they can time.
    func point(at share: Double) -> CGPoint {
        let back = 1 - share
        return CGPoint(
            x: back * back * start.x + 2 * back * share * control.x + share * share * end.x,
            y: back * back * start.y + 2 * back * share * control.y + share * share * end.y,
        )
    }
}
