import CoreGraphics

/// One co-change tie, drawn: an arc between two roofs, in the points the map is drawn in (#1160).
///
/// Solved HERE rather than in the shader, for `AtlasTrace`'s reason: the GPU draws faces, and a
/// curve a point or two wide across a projected picture is the one thing a triangle rasteriser has
/// no cheap answer for. It reads the projection the surface hands the GPU, so a cord cannot land
/// where its two files are not — a line resolved against a second projection is the class of
/// defect the id target already exists to remove.
///
/// A quadratic rather than a straight line, because a tie between two boxes on one ground would
/// otherwise run ALONG that ground and be read as a seam of the map rather than as a thing over
/// it. Which way it bows is the whole of what the two cameras change about a cord.
package struct AtlasCord: Equatable, Sendable {
    /// The roof of the first file, projected.
    package let start: CGPoint
    /// The one control point of the quadratic — where the cord is pulled off its own chord.
    package let control: CGPoint
    /// The roof of the second file.
    package let end: CGPoint

    /// The tie's own Jaccard, 0 to 1, carried so the drawing can spend brightness and weight on
    /// it: the strongest tie in a repository must not be drawn as the hundred and sixtieth is.
    package let strength: Double

    /// How far a flat cord leans off its own chord, as a share of it. Flat on there is no up — a
    /// bow up the screen would put every cord in a bundle on one shape — so the bow rotates into
    /// the plane, always to the same side of the chord, which fans the bundle out instead.
    package static let planBow = 0.15

    /// How far a standing cord is lifted off the ground, as a share of its run. Bigger than
    /// `planBow`, because in the city the cord has a whole third dimension to get out of the way
    /// into and the ground it would otherwise lie along is drawn in.
    package static let cityBow = 0.34

    /// The shortest run worth an arc, in points. Two files whose boxes sit on top of each other
    /// project onto very nearly one point, and a curve across three pixels is a blot the reader
    /// cannot read as a line.
    package static let shortestRun: CGFloat = 3

    /// The cord between two placed files, seen the way the map is being looked at — or nothing,
    /// where the two roofs land too close together to draw a line between.
    ///
    /// The two bows are LERPED on the camera's own `relief`, so the turn between the readings is
    /// continuous: a cord that swapped from one bow to the other at some threshold would jump
    /// across the map halfway through the step between the city and the treemap.
    package init?(
        between first: AtlasTile,
        and second: AtlasTile,
        through projection: AtlasProjection,
        strength: Double,
    ) {
        let start = AtlasCord.roof(of: first, through: projection)
        let end = AtlasCord.roof(of: second, through: projection)
        let chord = CGPoint(x: end.x - start.x, y: end.y - start.y)
        let run = (chord.x * chord.x + chord.y * chord.y).squareRoot()
        guard run >= AtlasCord.shortestRun else { return nil }
        let standing = projection.camera.relief
        let lean = AtlasCord.planBow * (1 - standing)
        self.start = start
        self.end = end
        self.control = CGPoint(
            // The perpendicular of the chord, which is the plan bow, and straight up the screen,
            // which is the city's. y counts DOWN here, so the lift is a subtraction.
            x: (start.x + end.x) / 2 - chord.y * lean,
            y: (start.y + end.y) / 2 + chord.x * lean - run * AtlasCord.cityBow * standing,
        )
        self.strength = strength
    }

    /// The middle of one file's roof, at the height it is drawn standing at. The ROOF and not the
    /// footprint: a cord leaving the ground would pass through the tower it leaves.
    private static func roof(of tile: AtlasTile, through projection: AtlasProjection) -> CGPoint {
        projection.viewPoint(x: tile.rect.midX, y: tile.rect.midY, height: tile.height)
    }
}
