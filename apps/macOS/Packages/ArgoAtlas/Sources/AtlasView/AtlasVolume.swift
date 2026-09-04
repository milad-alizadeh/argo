import ArgoDesign
import AtlasLayout
import CoreGraphics
import simd

/// One box handed to the GPU: where it stands on the map, how tall it stands, and what it is
/// painted in (#1150).
///
/// It mirrors the `AtlasVolume` struct in `AtlasVolume.metal` field for field. Neither side can see
/// the other's declaration, so what holds them together is `AtlasVolumeTests`, which asserts the
/// offsets this layout must have — a field reordered here does not fail to compile and does not
/// fail to draw, it draws a plausible wrong city.
struct AtlasVolume {
    var origin: SIMD2<Float>
    var size: SIMD2<Float>
    /// Where the box's foot and its roof stand, in the points the plan was tiled in. A plate is
    /// the two AT THE SAME height, which is what makes it a flat face rather than a slab: its
    /// walls come out degenerate and rasterise nothing.
    var heights: SIMD2<Float>
    /// A baked-in darkening, spent on top of the light model rather than instead of it (#1151). 1
    /// for an ordinary face; below 1 for a cast shadow's decal, where it is the one thing that
    /// tells the decal from the ground it sits on. Placed HERE, in the gap `AtlasVolumeTests`
    /// already names between `heights` and `pigment` — a scalar put after `pigment` instead would
    /// leave Metal rounding the struct up somewhere Swift's `MemoryLayout` does not follow it.
    var shade: Float = 1
    /// The pigment as it will be drawn. Whatever a face is painted in is already decided by the
    /// time it gets here.
    var pigment: SIMD3<Float>

    /// No caller ever stands a box off the ground: a plate's foot is its own roof, and a file's
    /// foot is the plate under it — 0, always. `foot` is not a parameter for that reason, not
    /// because the shader could not use one: `AtlasVolume.metal`'s wall still reads it as its own
    /// field, ready for the caller that first needs a box that does not start at the ground.
    init(_ rect: CGRect, roof: CGFloat = 0, shade: CGFloat = 1, pigment: ArgoColor) {
        self.origin = SIMD2<Float>(Float(rect.minX), Float(rect.minY))
        self.size = SIMD2<Float>(Float(rect.width), Float(rect.height))
        self.heights = SIMD2<Float>(0, Float(roof))
        self.shade = Float(shade)
        self.pigment = pigment.simd
    }
}

/// The camera, as the shader reads it: the turn, the fit onto the viewport, and how much of the
/// third dimension is left (#1150).
///
/// Every number here is solved by `AtlasCamera` and `AtlasFit`, never again on the GPU. A shader
/// that took the two angles and solved them itself would be a second declaration of the
/// projection, which is exactly the kind of thing that draws a plausible wrong picture rather than
/// failing to build.
struct AtlasEye {
    var centre: SIMD2<Float>
    /// The yaw as `(sin, cos)`, and the pitch after it. Solved, not taken as angles.
    var yaw: SIMD2<Float>
    var pitch: SIMD2<Float>
    var scale: SIMD2<Float>
    var offset: SIMD2<Float>
    var relief: Float
    /// How far the eye sits from the plan. Also what the depth range is bracketed off, so the
    /// shader needs no near and far of its own.
    var distance: Float

    init(_ camera: AtlasCamera, fit: AtlasFit) {
        self.centre = SIMD2<Float>(Float(camera.centre.x), Float(camera.centre.y))
        self.yaw = SIMD2<Float>(Float(camera.turn.sinYaw), Float(camera.turn.cosYaw))
        self.pitch = SIMD2<Float>(Float(camera.turn.sinPitch), Float(camera.turn.cosPitch))
        self.scale = SIMD2<Float>(Float(fit.scale.x), Float(fit.scale.y))
        self.offset = SIMD2<Float>(Float(fit.offset.x), Float(fit.offset.y))
        self.relief = Float(camera.relief)
        self.distance = Float(camera.eye)
    }
}

extension ArgoColor {
    /// The pigment alone. Opacity is dropped on purpose: a face on the map is opaque, and the alpha
    /// a role carries describes a wash over a ground rather than a material.
    var simd: SIMD3<Float> {
        SIMD3<Float>(Float(red), Float(green), Float(blue))
    }
}
