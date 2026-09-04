import ArgoDesign
import CoreGraphics
import simd

/// One rectangle handed to the GPU: where it sits on the map, and what it is painted in (#1147).
///
/// It mirrors the `AtlasFace` struct in `AtlasFace.metal` field for field. Neither side can see the
/// other's declaration, so what holds them together is `AtlasFaceTests`, which asserts the offsets
/// this layout must have — a field reordered here does not fail to compile and does not fail to
/// draw, it draws a plausible wrong map.
struct AtlasFace {
    var origin: SIMD2<Float>
    var size: SIMD2<Float>
    /// The pigment as it will be drawn. Whatever a face is painted in is already decided by the
    /// time it gets here.
    var pigment: SIMD3<Float>

    init(_ rect: CGRect, pigment: ArgoColor) {
        self.origin = SIMD2<Float>(Float(rect.minX), Float(rect.minY))
        self.size = SIMD2<Float>(Float(rect.width), Float(rect.height))
        self.pigment = pigment.simd
    }
}

/// The ground the faces are placed on: the plan's extent, in the points it was tiled in.
struct AtlasGround {
    var extent: SIMD2<Float>

    init(_ extent: CGSize) {
        self.extent = SIMD2<Float>(Float(extent.width), Float(extent.height))
    }
}

extension ArgoColor {
    /// The pigment alone. Opacity is dropped on purpose: a face on the map is opaque, and the alpha
    /// a role carries describes a wash over a ground rather than a material.
    var simd: SIMD3<Float> {
        SIMD3<Float>(Float(red), Float(green), Float(blue))
    }
}
