import CoreGraphics

/// How the map is being looked at: the plan, the camera over it, and the fit that frames the one
/// into the other.
///
/// One value rather than three passed together, because they are one reading and they are never
/// right apart — a fit solved against a different camera than the frame was drawn with is the
/// whole class of defect the id target exists to remove, and three parameters is three chances to
/// hand over a stale one.
///
/// The viewport is the plan's own extent, always. That is not a shortcut: it is the invariant the
/// flat camera's identity rests on — `AtlasView` frames the surface at `plan.extent`, and the
/// treemap is only exactly the tiling when the viewport is the shape the plan was tiled into.
package struct AtlasProjection: Equatable, Sendable {
    package let plan: AtlasPlan
    package let camera: AtlasCamera
    package let fit: AtlasFit

    /// How far the city has climbed out of its plates, 0 to 1 (#1421). It sits HERE for the
    /// reason the fit does: everything drawn over the surface has to agree with the shader about
    /// where a box is, and a box part way up its own climb is somewhere else. A trace solved
    /// against the settled height while the shader drew a climbing one is the same class of
    /// defect as a fit solved against a second camera.
    package let rise: Double

    /// `folder` is where the reader is STANDING, and the only thing a descent changes (#1490): the
    /// tiling is laid out from the repository's root once and the fit seats onto the plate. Nothing
    /// where they have descended into nothing, which frames the whole plan.
    package init(
        of plan: AtlasPlan,
        through camera: AtlasCamera,
        rising rise: Double = 1,
        standingIn folder: String? = nil,
    ) {
        self.plan = plan
        self.camera = camera
        self.fit = AtlasFit(
            framing: plan, through: camera, into: plan.extent, standingIn: folder,
        )
        self.rise = min(1, max(0, rise))
    }

    /// The ground the picture is framed into, which is what every caller sizes its view at.
    package var viewport: CGSize {
        plan.extent
    }

    /// The band a plate's name is drawn in, in the view's own points, or nothing where the plate
    /// is too small ON SCREEN to hold a line of type (#1490).
    ///
    /// Asked here rather than off the plate, because the plate carries its strip in PLAN points
    /// and the seat means the two are no longer the same thing: standing in a folder magnifies it,
    /// and a name laid out in plan points would stay where the folder used to be. The band keeps
    /// the type's own height at the top of the strip rather than growing with it — a caption is
    /// set at one size however close the camera stands.
    ///
    /// Flat only, which is the one place a name is drawn at all: the mapping below is a rect
    /// because the projection is affine there, and turned it would be a quadrilateral.
    package func nameBand(of plate: AtlasPlateFrame) -> CGRect? {
        let strip = viewRect(of: plate.nameStrip)
        // The tiler's own answer FIRST, in plan points. The camera at the fit is the identity, and
        // every strip the tiler cut is exactly `plateHeader` tall — so a height read back through
        // the projection decides those on a rounding bit, and the map loses half its names to
        // arithmetic. A seat can only ever add names, so the screen is asked only about the plates
        // the plan says are too small to carry one.
        guard plate.carriesName || strip.height >= AtlasFraming.plateHeader else { return nil }
        return CGRect(
            x: strip.minX, y: strip.minY, width: strip.width, height: AtlasFraming.plateHeader,
        )
    }

    /// One rect of the plan, on the ground, in the view's own points. Flat only, for `nameBand`'s
    /// reason.
    package func viewRect(of rect: CGRect) -> CGRect {
        let near = viewPoint(x: rect.minX, y: rect.minY, height: 0)
        let far = viewPoint(x: rect.maxX, y: rect.maxY, height: 0)
        return CGRect(
            x: min(near.x, far.x),
            y: min(near.y, far.y),
            width: abs(far.x - near.x),
            height: abs(far.y - near.y),
        )
    }

    /// One point of the model, in the view's own points: x right and y DOWN, which is where
    /// SwiftUI draws.
    ///
    /// The one flip in the package. Clip space counts y UP — it is what the shader reads and what
    /// `AtlasFit` produces — and anything drawn over the surface without this lands mirrored about
    /// the middle of the map, which looks plausible from the centre outward and is wrong
    /// everywhere.
    package func viewPoint(x: CGFloat, y: CGFloat, height: CGFloat) -> CGPoint {
        let clip = fit.clip(camera.project(x: x, y: y, height: height))
        return CGPoint(
            x: (clip.x + 1) / 2 * viewport.width,
            y: (1 - clip.y) / 2 * viewport.height,
        )
    }
}
