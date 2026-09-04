import CoreGraphics

/// The city's own turn and tilt — the two angles the reader drives, independent of `relief`
/// (#1152). `AtlasCamera` tweens BETWEEN this orientation and the treemap's fixed straight-down
/// one; it never turns on its own.
///
/// Held apart from `AtlasCamera` because the two change on different clocks: relief is an
/// animation the reader starts and lets finish, while yaw and pitch are driven live, one drag or
/// key press at a time, and never need the fit or the eye distance recomputed alongside them.
public struct AtlasOrientation: Equatable, Sendable {
    /// Both plan axes across the screen, which is what makes a city read as a city rather than as
    /// a wall; the true isometric pitch, where a unit cube's three visible faces come out equal —
    /// the opening view, and where a reset returns to.
    public static let opening = AtlasOrientation(yaw: .pi / 4, pitch: 0.6155)

    /// How far a tilt may run. Below the low end the roof is edge-on and unreadable; at or above
    /// the high end every wall is gone and the file reads as the treemap already does, which is a
    /// picture the reader can reach on purpose by lowering `relief` — not by tilting into it.
    public static let pitchRange = 0.10 ... 1.45

    public let yaw: Double
    public let pitch: Double

    /// `pitch` is held inside `pitchRange` here, once, so nothing downstream has to ask whether it
    /// holds a tilt nobody could read a city from.
    public init(yaw: Double, pitch: Double) {
        self.yaw = yaw
        self.pitch = min(Self.pitchRange.upperBound, max(Self.pitchRange.lowerBound, pitch))
    }

    /// This orientation, turned by a drag or a key press. Yaw is free — the city reads the same
    /// from any turn of it — and the clamp above is what keeps a long drag from tilting past where
    /// a city stays legible.
    public func turned(yaw deltaYaw: Double, pitch deltaPitch: Double) -> AtlasOrientation {
        AtlasOrientation(yaw: yaw + deltaYaw, pitch: pitch + deltaPitch)
    }
}

/// The one camera both views are drawn through (#1150).
///
/// `relief` runs 1 to 0 and is the WHOLE difference between them: it scales the heights, swings the
/// yaw back to square and the pitch to straight down, and pushes the eye to infinity. At 1 every
/// expression here is the city, turned to `orientation`; at 0 every one of them reduces to the
/// treemap regardless of it, and `AtlasCameraTests` asserts that the flat camera lands a plan rect
/// on exactly the clip coordinates the flat map was drawn on before any of this existed.
///
/// The projection is PERSPECTIVE at the city end, which is the approved design's own arithmetic —
/// the eye sits `eyeShare` of the plan away and everything divides by how far off it is. It
/// becomes orthographic at the flat end, because that is what pushing the eye to infinity means: a
/// flat picture drawn through a finite eye is a shear rather than a plan.
package struct AtlasCamera: Equatable, Sendable {
    /// How far off the plan the eye sits, as a share of the plan's longer side: the distance that
    /// frames it at the same 45° field of view the design's own camera uses.
    static let eyeShare = 1.7

    /// How much of the third dimension is left: 1 the city, 0 the treemap. Clamped on the way in,
    /// so nothing downstream has to ask whether it holds a number outside the two ends.
    package let relief: Double

    /// The ground the map was tiled into, in its own points. Both the eye distance and the centre
    /// everything turns about are read off it.
    package let plan: CGSize

    /// How far the eye sits from the plan. Never zero: a map tiled into no ground would divide the
    /// whole picture by nothing, and one NaN reaching the shader takes the city with it.
    package let eye: Double

    /// The plan point everything turns about.
    package let centre: CGPoint

    /// The four numbers the projection is really made of, solved once.
    ///
    /// Stored rather than read off `yaw` and `pitch` where they are needed, because the fit
    /// projects every corner of every volume in the map: a `cos` per term is six transcendentals a
    /// point, and the angles change once per camera at most.
    package let turn: AtlasTurn

    package init(relief: Double, orientation: AtlasOrientation = .opening, over plan: CGSize) {
        let held = min(1, max(0, relief))
        let yaw = orientation.yaw * held
        let pitch = orientation.pitch + (.pi / 2 - orientation.pitch) * (1 - held)
        self.relief = held
        self.plan = plan
        self.eye = max(max(plan.width, plan.height) * Self.eyeShare, 1)
        self.centre = CGPoint(x: plan.width / 2, y: plan.height / 2)
        self.turn = AtlasTurn(yaw: yaw, pitch: pitch)
    }

    /// The view that ships, and the one every wall and height in the picture is drawn for.
    package static func city(
        over plan: CGSize,
        orientation: AtlasOrientation = .opening,
    )
        -> AtlasCamera {
        AtlasCamera(relief: 1, orientation: orientation, over: plan)
    }

    /// The same layout seen straight down. Orientation is not a parameter here: every yaw and
    /// pitch reduce to the same straight-down picture at `relief` 0, which is the identity
    /// `AtlasCameraTests` holds the two views to.
    package static func flat(over plan: CGSize) -> AtlasCamera {
        AtlasCamera(relief: 0, over: plan)
    }

    /// Whether the third dimension is far enough gone that the walls, and everything else the city
    /// alone draws, are worth nothing. A threshold rather than an equality, because the parameter
    /// is tweened and a wall one part in a thousand tall is a seam of noise along every roof.
    package var isFlat: Bool {
        relief < 0.02
    }

    /// How far along the view axis a point of the model sits — the number the whole picture divides
    /// by, and the one the depth test orders by. Larger is further away.
    package func away(x: CGFloat, y: CGFloat, height: CGFloat) -> Double {
        away(turned(x: x, y: y).into, raised: Double(height) * relief)
    }

    /// One point of the model on the eye's own plane, before any fit onto a viewport. The result is
    /// clip-shaped: x right, y UP.
    ///
    /// The plan measures y DOWN from the top left and the design's own plan measures it up, so the
    /// two terms carrying y are the ones flipped against the arithmetic quoted in #1150 —
    /// everywhere else the expression is the design's. Flipping once here is what keeps the near
    /// corner of the city the bottom-left of the map, which is the corner the reader's own eye
    /// treats as nearest.
    package func project(x: CGFloat, y: CGFloat, height: CGFloat) -> CGPoint {
        let turned = turned(x: x, y: y)
        let raised = Double(height) * relief
        let away = away(turned.into, raised: raised)
        return CGPoint(
            x: turned.across / away,
            y: (turned.into * turn.sinPitch + raised * turn.cosPitch) / away,
        )
    }

    /// The distance both readings above divide by, written once. `relief` appears twice: it scales
    /// the height into `raised`, and it scales the whole term, which is what pushes the eye to
    /// infinity as the camera goes flat.
    private func away(_ into: Double, raised: Double) -> Double {
        eye + (into * turn.cosPitch - raised * turn.sinPitch) * relief
    }

    /// The plan point, turned about the centre: how far across the view it sits, and how far into
    /// it. Both readings above need the pair, and a projection cannot afford to solve the yaw
    /// twice per point.
    ///
    /// `into` runs AWAY from the reader, so the top of the map is the far edge — which is why the
    /// y terms carry the signs they do.
    private func turned(x: CGFloat, y: CGFloat) -> (across: Double, into: Double) {
        let right = Double(x - centre.x)
        let down = Double(y - centre.y)
        return (
            right * turn.cosYaw + down * turn.sinYaw,
            right * turn.sinYaw - down * turn.cosYaw,
        )
    }
}

/// The camera's two angles, solved. `package` because the drawing half hands exactly these four
/// numbers to the shader — a shader that took the angles and solved them again would be a second
/// declaration of the projection, which is the failure `AtlasVolumeTests` exists to catch.
package struct AtlasTurn: Equatable, Sendable {
    package let sinYaw: Double
    package let cosYaw: Double
    package let sinPitch: Double
    package let cosPitch: Double

    package init(yaw: Double, pitch: Double) {
        self.sinYaw = sin(yaw)
        self.cosYaw = cos(yaw)
        self.sinPitch = sin(pitch)
        self.cosPitch = cos(pitch)
    }
}
