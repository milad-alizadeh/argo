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

    package init(of plan: AtlasPlan, through camera: AtlasCamera, rising rise: Double = 1) {
        self.plan = plan
        self.camera = camera
        self.fit = AtlasFit(framing: plan, through: camera, into: plan.extent)
        self.rise = min(1, max(0, rise))
    }

    /// The ground the picture is framed into, which is what every caller sizes its view at.
    package var viewport: CGSize {
        plan.extent
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
