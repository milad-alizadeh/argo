@testable import AtlasView

/// What the harness can say about the BARE GROUND of a frame — the pixels on no box at all.
///
/// It hangs off the harness because the harness is what knows what is on a box: "on no box" is
/// asked of the id target, so nothing here has to know what the ground is painted in to find it
/// (#1600).
extension AtlasPickHarness {
    /// Every bare-ground pixel of one frame, as how far it sits from the middle of the drawable
    /// and how bright it came out.
    func bareGround(in frame: AtlasFrame) -> [(reach: Double, light: Double)] {
        let size = AtlasPickHarness.size
        let middle = (x: Double(size.width) / 2, y: Double(size.height) / 2)
        return (0 ..< size.width * size.height).compactMap { index in
            let x = index % size.width
            let y = index / size.width
            guard pick(at: AtlasPixel(x: x, y: y))?.target == nil else { return nil }
            let across = Double(x) - middle.x
            let down = Double(y) - middle.y
            return (
                reach: (across * across + down * down).squareRoot(),
                light: frame.light(atPixel: index),
            )
        }
    }

    /// The darkest bare-ground pixel within a few of one point.
    ///
    /// The darkest, because everything drawn on the floor only ever ADDS light: a single pixel
    /// near the middle of the plan is as likely to be a crossing of the contour grid as it is to
    /// be the ground under it.
    func darkestGround(around pixel: AtlasPixel, in frame: AtlasFrame) -> Double {
        let size = AtlasPickHarness.size
        var darkest = Double.infinity
        for y in (pixel.y - 4) ... (pixel.y + 4) {
            for x in (pixel.x - 4) ... (pixel.x + 4) {
                guard x >= 0, y >= 0, x < size.width, y < size.height,
                      pick(at: AtlasPixel(x: x, y: y))?.target == nil
                else { continue }
                darkest = min(darkest, frame.light(atPixel: y * size.width + x))
            }
        }
        return darkest
    }
}
