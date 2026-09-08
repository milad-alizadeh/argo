import ArgoDesign
import AtlasLayout
import CoreGraphics
import simd

/// The floor's own numbers, as the shader reads them: the three stops of the graded ground, how far
/// the grade and the vignette reach, the plane the floor lies on, and what the grain is spent at
/// (#1600).
///
/// It mirrors the `AtlasGround` struct in `AtlasVolume.metal` field for field, and
/// `AtlasFloorTests` asserts the offsets for the reason `AtlasVolumeTests` asserts the instance's.
///
/// Everything here is resolved when the map is, EXCEPT `size` — the drawable's own size, which only
/// the frame knows, and which `AtlasVolumeRenderer.encode` fills in from the target it draws into.
struct AtlasGround: Equatable {
    /// The drawable, in pixels. Every reach below is a SHARE of one of its sides, so the grade and
    /// the falloff are the same picture in a small window and a large one.
    var size: SIMD2<Float>
    /// The middle stop: the ground where the lamp reaches it, at the middle of the plan.
    var lit: SIMD3<Float>
    /// The dip, half way out.
    var deep: SIMD3<Float>
    /// The desktop tone, which the grade returns to at the rim and the vignette lands on.
    var rim: SIMD3<Float>
    /// How far out the grade runs, as a share of the drawable's longer side.
    var grade: Float
    /// Where the vignette starts, as a share of the shorter side, and where it lands, as a share of
    /// the longer.
    var falloff: SIMD2<Float>
    /// The floor's own plane, in the plan's own points. Negative: it is under the plates.
    var drop: Float
    /// The weight the grain is spent at.
    var grain: Float

    /// How far out the grade runs (`drawFloor`, where it is `max(W, H) * 0.72`).
    static let grade: Float = 0.72

    /// Where the vignette starts and where it lands (`vignette`: `min(W, H) * 0.30` out to
    /// `max(W, H) * 0.62`).
    static let falloff = SIMD2<Float>(0.30, 0.62)

    /// What the grain is spent at: the design's own overlay fill at 0.05 (`rebuild`).
    static let grain: Float = 0.05

    /// The floor of a map with nothing standing on it, which is never drawn — `encode` returns
    /// before it reaches this for a city with no boxes.
    static let none = AtlasGround()

    private init() {
        self.size = .zero
        self.lit = .zero
        self.deep = .zero
        self.rim = .zero
        self.grade = 0
        self.falloff = .zero
        self.drop = 0
        self.grain = 0
    }

    /// The floor one plan is drawn on, in the contract's own tones.
    init(plan: CGSize, in pigments: AtlasPigments) {
        self.size = .zero
        self.lit = pigments.groundLit.simd
        self.deep = pigments.groundDeep.simd
        self.rim = pigments.desktop.simd
        self.grade = Self.grade
        self.falloff = Self.falloff
        self.drop = Float(AtlasElevation.drop(of: plan))
        self.grain = Self.grain
    }
}
