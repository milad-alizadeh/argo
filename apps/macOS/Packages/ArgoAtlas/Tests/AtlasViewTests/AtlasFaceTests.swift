import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The one thing about a shader that fails silently.
///
/// `AtlasFace` and the `AtlasFace` struct in `AtlasFace.metal` are two declarations of one layout,
/// and nothing in either language checks them against each other. A field reordered or a `Float`
/// widened on the Swift side does not fail to compile and does not fail to draw — it draws a map
/// whose files are the wrong colour, or in the wrong place, and the picture stays plausible.
///
/// So the offsets are asserted here as numbers. They are Metal's, derived from its packing rules:
/// a `float2` occupies 8 bytes and aligns to 8, a `float3` occupies 16 and aligns to 16. A change
/// on the Swift side reds this file, and the numbers say what the shader must change to.
@Suite("Atlas — the shader's faces")
struct AtlasFaceTests {
    @Test func `the swift struct is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasFace>.offset(of: \.origin) == 0)
        #expect(MemoryLayout<AtlasFace>.offset(of: \.size) == 8)
        // 16 rather than 16 by luck: the `float3` aligns to 16, so the two `float2`s ahead of it
        // fill exactly the gap and nothing is padded. Put a scalar between them and both languages
        // still agree — put one AFTER the pigment and only Metal rounds the struct up.
        #expect(MemoryLayout<AtlasFace>.offset(of: \.pigment) == 16)
        // The stride, not the size: it is what the instance buffer is indexed by, and Metal's own
        // size for this struct is 32 — the number Swift only reaches by rounding up.
        #expect(MemoryLayout<AtlasFace>.stride == 32)
    }

    @Test func `the ground crosses as the two floats the shader divides by`() {
        let ground = AtlasGround(CGSize(width: 1200, height: 800))

        #expect(ground.extent == SIMD2<Float>(1200, 800))
        #expect(MemoryLayout<AtlasGround>.stride == 8)
    }

    /// The pigment crosses as three channels. Opacity is dropped, and this says so rather than
    /// leaving the next reader to wonder whether a fourth channel was forgotten.
    @Test func `a pigment crosses as its three channels, opacity dropped`() {
        let washed = ArgoColor(red: 0.2, green: 0.4, blue: 0.6, opacity: 0.3)

        #expect(washed.simd == SIMD3<Float>(0.2, 0.4, 0.6))
    }
}
