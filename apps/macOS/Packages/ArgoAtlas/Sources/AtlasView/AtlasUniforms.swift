import ArgoDesign
import simd

/// What `AtlasQuad.metal` is handed each frame: a pigment, the face it lies on, and `ArgoLight`'s
/// three lamps (#1144).
///
/// It mirrors the `AtlasUniforms` struct in the shader field for field. Neither side can see the
/// other's declaration, so what holds them together is `AtlasUniformsTests`, which asserts the
/// offsets this layout must have — `SIMD3<Float>` occupies 16 bytes in Swift and `float3` occupies
/// 16 in Metal, and every field here is placed by that one fact.
///
/// The lamps are passed rather than written into the shader. A shader that hard-coded a lamp would
/// be a second contract, and `ArgoLight` says in as many words that the ticket writing the shader
/// may not re-derive a number it can read.
struct AtlasUniforms {
    /// One lamp, flattened to what a GPU can take: `ArgoLight.Lamp` holds a `Double` direction and
    /// an `ArgoColor`, and neither crosses to Metal as it stands.
    struct Lamp {
        var direction: SIMD3<Float>
        var tint: SIMD3<Float>
        var intensity: Float

        init(_ lamp: ArgoLight.Lamp) {
            self.direction = SIMD3<Float>(lamp.direction)
            self.tint = lamp.tint.simd
            self.intensity = Float(lamp.intensity)
        }
    }

    var pigment: SIMD3<Float>
    var normal: SIMD3<Float>
    var ambient: SIMD3<Float>
    /// Ahead of the lamps, and that order is load-bearing rather than taste. Metal rounds a
    /// struct's SIZE up to its alignment and Swift does not, so a `Lamp` is 48 bytes to the shader
    /// and 36 to Swift — put a scalar AFTER one and the two languages disagree by 12 bytes and the
    /// picture stays plausible. Put it before, and every field lands on the same offset in both.
    /// `AtlasUniformsTests` is what found this and what holds it.
    var halfExtent: Float
    var key: Lamp
    var fill: Lamp

    /// The one quad, facing the viewer.
    ///
    /// `normal` is `+z` because there is no camera yet: the plate is screen-aligned, so the face
    /// the lamps land on is the one pointed at the eye. When the camera arrives this becomes the
    /// roof's own normal and nothing else here changes.
    init(pigment: ArgoColor, halfExtent: Float) {
        self.pigment = pigment.simd
        self.normal = SIMD3<Float>(0, 0, 1)
        // Driven by its intensity like the other two, even though that is 1 today. `ArgoLight`
        // says the sky term's colour IS its strength, and a uniform that dropped the number would
        // make turning the sky down in the contract change nothing on screen.
        self.ambient = ArgoLight.ambient.tint.simd * Float(ArgoLight.ambient.intensity)
        self.halfExtent = halfExtent
        self.key = Lamp(ArgoLight.key)
        self.fill = Lamp(ArgoLight.fill)
    }
}

extension ArgoColor {
    /// The pigment alone. Opacity is dropped on purpose: a lit face is opaque, and the alpha a
    /// role carries describes a wash over a ground rather than a material.
    var simd: SIMD3<Float> {
        SIMD3<Float>(Float(red), Float(green), Float(blue))
    }
}
