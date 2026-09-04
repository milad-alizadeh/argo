import CoreGraphics

/// What turns the eye's own plane into clip space: the zoom that frames the whole picture, and
/// where its middle sits (#1150).
///
/// Measured off the picture the camera actually draws: the tallest tower is nowhere near a corner,
/// and reserving the full height at the far corner leaves the map sitting high with a band of
/// nothing under it.
///
/// The zoom is UNIFORM, one number for both axes. It reduces to the flat map's own clip mapping
/// EXACTLY when the viewport is the shape the plan was tiled into — an invariant `AtlasSurface`
/// keeps by framing into `plan.extent`, and `AtlasCameraTests` is what holds it.
package struct AtlasFit: Equatable, Sendable {
    /// Eye-plane units to clip units, per axis. The two differ only by the viewport's own aspect:
    /// the zoom behind them is one number.
    package let scale: CGPoint

    /// Where the picture's middle lands in clip space.
    package let offset: CGPoint

    package init(scale: CGPoint, offset: CGPoint) {
        self.scale = scale
        self.offset = offset
    }

    /// The fit that frames one plan, seen through one camera, in one viewport.
    package init(framing plan: AtlasPlan, through camera: AtlasCamera, into viewport: CGSize) {
        var box = AtlasFit.Box()
        // The whole ground, which covers every face at zero height: the projection of a plane is
        // convex, so a rect inside the extent lands inside the extent's own projected quad.
        for corner in AtlasFit.corners(of: CGRect(origin: .zero, size: plan.extent)) {
            box.take(camera.project(x: corner.x, y: corner.y, height: 0))
        }
        // Only the roofs are left, and only they can leave that quad.
        for tile in plan.tiles {
            for corner in AtlasFit.corners(of: tile.rect) {
                box.take(camera.project(x: corner.x, y: corner.y, height: tile.height))
            }
        }
        self.init(framing: box, into: viewport)
    }

    private init(framing box: Box, into viewport: CGSize) {
        let width = box.width
        let height = box.height
        guard width > 0, height > 0, viewport.width > 0, viewport.height > 0 else {
            // Nothing to frame, and nothing drawn: a zoom of zero rather than a division by one of
            // them, which reaches the shader as a NaN and takes the picture with it.
            self.init(scale: .zero, offset: .zero)
            return
        }
        let zoom = min(viewport.width / width, viewport.height / height)
        let scale = CGPoint(x: zoom / (viewport.width / 2), y: zoom / (viewport.height / 2))
        self.init(
            scale: scale,
            offset: CGPoint(x: -box.middle.x * scale.x, y: -box.middle.y * scale.y),
        )
    }

    /// One projected point, in clip space.
    package func clip(_ point: CGPoint) -> CGPoint {
        CGPoint(x: point.x * scale.x + offset.x, y: point.y * scale.y + offset.y)
    }

    private static func corners(of rect: CGRect) -> [CGPoint] {
        [
            CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY),
        ]
    }

    /// The picture's own extent, grown a point at a time. A `CGRect.union` per corner would build
    /// a rectangle for every one of the twelve thousand this walks over a real repository.
    private struct Box {
        var low = CGPoint(x: CGFloat.infinity, y: CGFloat.infinity)
        var high = CGPoint(x: -CGFloat.infinity, y: -CGFloat.infinity)

        var width: CGFloat {
            high.x - low.x
        }

        var height: CGFloat {
            high.y - low.y
        }

        var middle: CGPoint {
            CGPoint(x: (low.x + high.x) / 2, y: (low.y + high.y) / 2)
        }

        mutating func take(_ point: CGPoint) {
            low = CGPoint(x: min(low.x, point.x), y: min(low.y, point.y))
            high = CGPoint(x: max(high.x, point.x), y: max(high.y, point.y))
        }
    }
}
