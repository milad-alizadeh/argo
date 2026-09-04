import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The one thing about a shader that fails silently.
///
/// `AtlasVolume` and `AtlasEye` are each declared TWICE — once here and once in
/// `AtlasVolume.metal` — and nothing in either language checks the pair against each other. A
/// field reordered or a `Float` widened on the Swift side does not fail to compile and does not
/// fail to draw: it draws a city whose files are the wrong colour, or the wrong height, or turned
/// through an angle nobody chose, and the picture stays plausible.
///
/// So the offsets are asserted here as numbers. They are Metal's, derived from its packing rules:
/// a `float2` occupies 8 bytes and aligns to 8, a `float3` occupies 16 and aligns to 16, a `float`
/// 4 and 4. A change on the Swift side reds this file, and the numbers say what the shader must
/// change to.
@Suite("Atlas — the shader's volumes")
struct AtlasVolumeTests {
    @Test func `the volume is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasVolume>.offset(of: \.origin) == 0)
        #expect(MemoryLayout<AtlasVolume>.offset(of: \.size) == 8)
        #expect(MemoryLayout<AtlasVolume>.offset(of: \.heights) == 16)
        // 24, not 32: `shade` is the scalar that spends the eight bytes of padding the `float3`
        // ahead of it would otherwise leave — the gap BOTH languages insert the same way. A
        // scalar put after `pigment` instead would leave Metal rounding the struct up somewhere
        // Swift's `MemoryLayout` does not follow it.
        #expect(MemoryLayout<AtlasVolume>.offset(of: \.shade) == 24)
        #expect(MemoryLayout<AtlasVolume>.offset(of: \.pigment) == 32)
        // The stride, not the size: it is what the instance buffer is indexed by, and Metal's own
        // size for this struct is 48 — the number Swift only reaches by rounding up.
        #expect(MemoryLayout<AtlasVolume>.stride == 48)
    }

    @Test func `the camera is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasEye>.offset(of: \.centre) == 0)
        #expect(MemoryLayout<AtlasEye>.offset(of: \.yaw) == 8)
        #expect(MemoryLayout<AtlasEye>.offset(of: \.pitch) == 16)
        #expect(MemoryLayout<AtlasEye>.offset(of: \.scale) == 24)
        #expect(MemoryLayout<AtlasEye>.offset(of: \.offset) == 32)
        #expect(MemoryLayout<AtlasEye>.offset(of: \.relief) == 40)
        #expect(MemoryLayout<AtlasEye>.offset(of: \.distance) == 44)
        #expect(MemoryLayout<AtlasEye>.stride == 48)
    }

    /// The camera crosses SOLVED. Every number the shader reads is one `AtlasCamera` and
    /// `AtlasFit` already worked out, because a shader holding an angle would be a second
    /// declaration of the projection and the two would drift the first time either changed.
    @Test func `the camera crosses solved, never as an angle`() {
        let camera = AtlasCamera.city(over: CGSize(width: 620, height: 400))
        let fit = AtlasFit(scale: CGPoint(x: 3, y: 4), offset: CGPoint(x: -0.5, y: 0.25))

        let eye = AtlasEye(camera, fit: fit)

        #expect(eye.centre == SIMD2<Float>(310, 200))
        #expect(eye.yaw == SIMD2<Float>(Float(camera.turn.sinYaw), Float(camera.turn.cosYaw)))
        #expect(eye.pitch == SIMD2<Float>(Float(camera.turn.sinPitch), Float(camera.turn.cosPitch)))
        #expect(eye.scale == SIMD2<Float>(3, 4))
        #expect(eye.offset == SIMD2<Float>(-0.5, 0.25))
        #expect(eye.relief == 1)
        #expect(eye.distance == Float(camera.eye))
    }

    /// The pigment crosses as three channels. Opacity is dropped, and this says so rather than
    /// leaving the next reader to wonder whether a fourth channel was forgotten.
    @Test func `a pigment crosses as its three channels, opacity dropped`() {
        let washed = ArgoColor(red: 0.2, green: 0.4, blue: 0.6, opacity: 0.3)

        #expect(washed.simd == SIMD3<Float>(0.2, 0.4, 0.6))
    }
}
