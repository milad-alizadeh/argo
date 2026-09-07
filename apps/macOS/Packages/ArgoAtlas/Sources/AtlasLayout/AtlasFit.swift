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
    /// How close a seated camera may come, and how far back it may stand, as multiples of the zoom
    /// that frames the whole plan (`docs/designs/cockpit-atlas.html` line 1486).
    static let nearest = 90.0
    static let furthest = 0.5

    /// Eye-plane units to clip units, per axis. The two differ only by the viewport's own aspect:
    /// the zoom behind them is one number.
    package let scale: CGPoint

    /// Where the picture's middle lands in clip space.
    package let offset: CGPoint

    package init(scale: CGPoint, offset: CGPoint) {
        self.scale = scale
        self.offset = offset
    }

    /// The fit that frames one plan, seen through one camera, in one viewport — the whole of it,
    /// which is where a reader who has descended into nothing stands.
    package init(framing plan: AtlasPlan, through camera: AtlasCamera, into viewport: CGSize) {
        self.init(framing: plan, through: camera, into: viewport, standingIn: nil)
    }

    /// The same fit, seated on the plate the reader is standing on (#1490).
    ///
    /// **The seat is the whole of a descent.** There is ONE tiling, laid out from the repository's
    /// root and never rebuilt, so going into a folder is the same picture larger rather than a
    /// second picture — only this number moves (`docs/designs/cockpit-atlas.html`, "WHY NOTHING
    /// RE-TILES ANY MORE", and `seatCam`, which this is).
    ///
    /// Only at the FLAT end. The city's camera is the reader's — they drive its turn and tilt, and
    /// a descent that seated it too would take the view away from whoever was looking through it.
    /// The design says the same twice: `goTo` refuses to fly there, and the turn back to the plan
    /// re-seats only once it has landed (line 2820).
    ///
    /// **Landed, not nearly** — `isFlat` is the wrong question here, and asking it was a bug. It is
    /// a threshold, because a wall one part in a thousand tall is a seam of noise along a roof; a
    /// seat is not a seam but a jump of up to ninety times, and at that threshold the turn would
    /// take it 98% of the way through. The turn frames the whole plan for every frame of its
    /// travel, exactly as the design refits every frame of its own, and seats when it arrives.
    ///
    /// A folder no plate stands under is the whole plan, which is `descending(to:)`'s own
    /// degrade-down: a reader whose folder went out from under them is at the top rather than
    /// somewhere the picture cannot frame.
    package init(
        framing plan: AtlasPlan,
        through camera: AtlasCamera,
        into viewport: CGSize,
        standingIn folder: String?,
    ) {
        self.init(
            seatedAt: AtlasFit.seat(
                framing: plan, through: camera, into: viewport, standingIn: folder,
            ),
            into: viewport,
        )
    }

    /// The seat a folder names, as the three numbers it is made of (#1423).
    ///
    /// Lifted out of the initializer above and otherwise unchanged. It is a VALUE now because a
    /// flight moves between two of them and every frame in between is a seat this arithmetic never
    /// names — a folder cannot be interpolated, and the numbers it resolves to can.
    package static func seat(
        framing plan: AtlasPlan,
        through camera: AtlasCamera,
        into viewport: CGSize,
        standingIn folder: String?,
    )
        -> AtlasSeat {
        let whole = AtlasFit.box(framing: plan, through: camera)
        let fitted = AtlasFit.zoom(framing: whole, into: viewport)
        let unseated = AtlasSeat(middle: whole.middle, zoom: fitted)
        guard camera.relief == 0, let folder, let plate = plan.plate(standingIn: folder) else {
            return unseated
        }
        // The plate's own ground, at no height: what stands on it is inside it, and at the flat
        // camera a height moves nothing at all (`AtlasCameraTests`).
        var seat = AtlasFit.Box()
        for corner in AtlasFit.corners(of: plate.rect) {
            seat.take(camera.project(x: corner.x, y: corner.y, height: 0))
        }
        // A plate with no area is no seat: framing a point would put the whole map at whatever the
        // clamp below allowed, centred on nothing. The whole plan, which is where a folder the
        // picture cannot frame already sends the reader.
        let seated = AtlasFit.zoom(framing: seat, into: viewport)
        guard seated > 0 else { return unseated }
        // Bounded off the FITTED zoom rather than off itself, so however deep the descent runs the
        // camera cannot arrive somewhere nothing could fly it to (`cockpit-atlas.html` line 1486).
        // Both ends are slack on any repository measured so far — the deepest plate seats at a
        // couple of times the fit — and a bound that holds only for the data you happened to
        // measure is a bound that will be wrong silently.
        return AtlasSeat(
            middle: seat.middle,
            zoom: min(fitted * AtlasFit.nearest, max(fitted * AtlasFit.furthest, seated)),
        )
    }

    /// The fit one seat draws through.
    package init(seatedAt seat: AtlasSeat, into viewport: CGSize) {
        guard seat.isDrawable, viewport.width > 0, viewport.height > 0 else {
            // Nothing to frame, and nothing drawn: a zoom of zero rather than a division by one of
            // them, which reaches the shader as a NaN and takes the picture with it.
            self.init(scale: .zero, offset: .zero)
            return
        }
        let scale = CGPoint(
            x: seat.zoom / (viewport.width / 2), y: seat.zoom / (viewport.height / 2),
        )
        self.init(
            scale: scale,
            offset: CGPoint(x: -seat.middle.x * scale.x, y: -seat.middle.y * scale.y),
        )
    }

    /// Everything one camera draws of one plan, on the eye's own plane.
    private static func box(framing plan: AtlasPlan, through camera: AtlasCamera) -> Box {
        var box = Box()
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
        return box
    }

    /// The zoom that frames one box in one viewport, one number for both axes. Zero where there is
    /// nothing to frame or nowhere to frame it into.
    private static func zoom(framing box: Box, into viewport: CGSize) -> CGFloat {
        guard box.width > 0, box.height > 0, viewport.width > 0, viewport.height > 0 else {
            return 0
        }
        return min(viewport.width / box.width, viewport.height / box.height)
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
