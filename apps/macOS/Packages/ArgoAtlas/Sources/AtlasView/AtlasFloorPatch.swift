import ArgoDesign
import CoreGraphics
import simd

/// One patch of light laid on the floor, as the GPU takes it: a plate's own light, or the contour
/// grid (#1600).
///
/// The two are one primitive because they are one fact — light on the floor, bounded by the same
/// vignette — and one instanced draw is what keeps them from needing a pipeline each. `divisions`
/// is the whole difference between them.
///
/// It mirrors the `AtlasFloorPatch` struct in `AtlasVolume.metal` field for field. Neither side can
/// see the other's declaration, so what holds them together is `AtlasFloorTests`, which asserts
/// the offsets this layout must have — a field reordered here does not fail to compile and does
/// not fail to draw, it draws a plausible wrong floor.
struct AtlasFloorPatch: Equatable {
    /// Where the patch lies on the plan: origin, then size, in the plan's own points.
    var plan: SIMD4<Float>
    /// What it is washed in: a pigment, and the weight it is spent at.
    var wash: SIMD4<Float>
    /// 0 for a flat wash. Above 0 it is a contour grid at that many divisions of the patch's own
    /// span, which is what lets one quad carry a lattice instead of eighty-four line segments.
    var divisions: Float

    init(_ rect: CGRect, pigment: ArgoColor, weight: Double, divisions: Int = 0) {
        self.plan = SIMD4<Float>(
            Float(rect.minX), Float(rect.minY), Float(rect.width), Float(rect.height),
        )
        self.wash = SIMD4<Float>(
            Float(pigment.red), Float(pigment.green), Float(pigment.blue), Float(weight),
        )
        self.divisions = Float(divisions)
    }
}
