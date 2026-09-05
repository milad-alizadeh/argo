import CoreGraphics

/// The open file, traced: its whole volume drawn edge by edge, in the points the map is drawn in
/// (#1154).
///
/// **Focus never repaints the thing it marks.** The colour IS the measure, so marking a file by
/// recolouring it destroys the fact the reader was inspecting. What the mark can spend instead is
/// geometry: the edges of the box, and nothing of its faces.
///
/// Solved HERE rather than in the shader, for `AtlasPlateNames`' reason turned round — the shader
/// draws faces, and a line one point wide across a projected silhouette is the one thing a
/// triangle rasteriser has no cheap answer for. It reads the projection the surface hands the GPU,
/// so the trace cannot land somewhere the volume is not: a mark resolved against a second
/// projection is the class of defect the id target already exists to remove.
package struct AtlasTrace: Equatable, Sendable {
    /// The edges to stroke, each an open polyline of view points, in the order they are drawn.
    ///
    /// Several rather than one path, because the silhouette of a box is not one run: the roof is a
    /// closed loop and the three standing corners are separate strokes, and joining them would
    /// draw a diagonal across the roof on the way to each.
    package let strokes: [[CGPoint]]

    package init(strokes: [[CGPoint]]) {
        self.strokes = strokes
    }

    /// The trace of one tile, seen the way the map is being looked at.
    ///
    /// Flat on, or on a file standing no taller than the floor every file stands, the STANDING
    /// corners are dropped: every edge of the box projects onto its own footprint there, and
    /// tracing them would draw one rectangle four times over and read as a stutter rather than as
    /// a shape.
    package init(of tile: AtlasTile, through projection: AtlasProjection) {
        let corners = AtlasTrace.corners(of: tile.rect)
        let near = AtlasTrace.nearest(of: corners, to: projection.camera)
        func point(_ step: Int, _ height: CGFloat) -> CGPoint {
            let corner = corners[(near + step) % corners.count]
            return projection.viewPoint(x: corner.x, y: corner.y, height: height)
        }
        // The roof, walked from the far corner round to itself, so the loop closes on the edge
        // furthest from the reader rather than on one they are looking straight at.
        let roof = [2, 3, 0, 1, 2].map { point($0, tile.height) }
        let floor = AtlasElevation.floor(of: projection.plan.extent)
        guard !projection.camera.isFlat, tile.height > floor else {
            self.init(strokes: [roof])
            return
        }
        let standing = [3, 0, 1].map { [point($0, tile.height), point($0, 0)] }
        // The three corners of the foot that are not hidden behind the box itself — the same three
        // the standing edges came down.
        let foot = [3, 0, 1].map { point($0, 0) }
        self.init(strokes: [roof] + standing + [foot])
    }

    /// The footprint's four corners, in the order the plan reads them: the two low-y first, so
    /// stepping one on from any of them walks the rectangle rather than crossing it.
    private static func corners(of rect: CGRect) -> [CGPoint] {
        [
            CGPoint(x: rect.minX, y: rect.minY), CGPoint(x: rect.maxX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.maxY), CGPoint(x: rect.minX, y: rect.maxY),
        ]
    }

    /// Which corner is nearest the reader, which is what decides where the silhouette's far seam
    /// is and which three corners stand in front of the box rather than behind it.
    ///
    /// Found per trace rather than fixed to one pair of sides, because the reader turns the city:
    /// the near corner at one yaw is the far corner a half turn later.
    ///
    /// Read off the footprint, at no height at all: the height term is the same for all four
    /// corners of one box, so it moves every reading together and can decide none of them.
    private static func nearest(of corners: [CGPoint], to camera: AtlasCamera) -> Int {
        var near = 0
        var least = Double.infinity
        for (index, corner) in corners.enumerated() {
            let away = camera.away(x: corner.x, y: corner.y, height: 0)
            if away < least {
                least = away
                near = index
            }
        }
        return near
    }
}
