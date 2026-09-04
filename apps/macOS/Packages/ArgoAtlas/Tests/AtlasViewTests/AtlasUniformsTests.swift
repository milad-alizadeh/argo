import ArgoDesign
@testable import AtlasView
import Testing

/// The one thing about a shader that fails silently.
///
/// `AtlasUniforms` and the `AtlasUniforms` struct in `AtlasQuad.metal` are two declarations of one
/// layout, and nothing in either language checks them against each other. A field reordered or a
/// `Float` widened on the Swift side does not fail to compile and does not fail to draw — it draws
/// the wrong colour, or a plate lit from a direction nobody chose, and the picture stays plausible.
///
/// So the offsets are asserted here as numbers. They are Metal's, derived from its one rule: a
/// `float3` occupies 16 bytes and aligns to 16, so every field lands where 16-byte packing puts it.
/// A change on the Swift side reds this file, and the numbers say what the shader must change to.
@Suite("Atlas — the shader's uniforms")
struct AtlasUniformsTests {
    @Test func `the swift struct is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasUniforms>.offset(of: \.pigment) == 0)
        #expect(MemoryLayout<AtlasUniforms>.offset(of: \.normal) == 16)
        #expect(MemoryLayout<AtlasUniforms>.offset(of: \.ambient) == 32)
        #expect(MemoryLayout<AtlasUniforms>.offset(of: \.halfExtent) == 48)
        #expect(MemoryLayout<AtlasUniforms>.offset(of: \.key) == 64)
        #expect(MemoryLayout<AtlasUniforms>.offset(of: \.fill) == 112)
        // The stride, not the size: it is what `setVertexBytes` is given, and Metal's own size for
        // this struct is 160 — the number Swift only reaches by rounding up.
        #expect(MemoryLayout<AtlasUniforms>.stride == 160)
    }

    /// A lamp is a struct inside a struct, and the one place 16-byte packing costs bytes: three
    /// fields totalling 36 occupy 48. The shader pads identically, and the two only agree while
    /// that 48 is the number the `fill` offset above is reached by.
    @Test func `a lamp occupies the 48 bytes the fill lamp's offset assumes`() {
        #expect(MemoryLayout<AtlasUniforms.Lamp>.stride == 48)
        #expect(MemoryLayout<AtlasUniforms.Lamp>.offset(of: \.direction) == 0)
        #expect(MemoryLayout<AtlasUniforms.Lamp>.offset(of: \.tint) == 16)
        #expect(MemoryLayout<AtlasUniforms.Lamp>.offset(of: \.intensity) == 32)
    }

    /// The lamps are read from the contract, never written here — the drift `ArgoLight`'s own note
    /// warns about is a renderer that re-derived a number it could have read.
    @Test func `the uniforms carry ArgoLight's own lamps`() {
        let uniforms = AtlasUniforms(pigment: ArgoColor(hex: 0x336699), halfExtent: 0.5)

        #expect(uniforms.key.intensity == Float(ArgoLight.key.intensity))
        #expect(uniforms.fill.intensity == Float(ArgoLight.fill.intensity))
        #expect(uniforms.key.direction == SIMD3<Float>(ArgoLight.key.direction))
        // The sky term is driven too. Asserted against the product rather than the tint alone,
        // because `ArgoLight.ambient.intensity` is 1 today and a test written against the tint
        // would pass while the number was being dropped.
        let sky = ArgoLight.ambient
        #expect(uniforms.ambient == sky.tint.simd * Float(sky.intensity))
    }

    /// The pigment crosses as three channels. Opacity is dropped, and this says so rather than
    /// leaving the next reader to wonder whether a fourth channel was forgotten.
    @Test func `a pigment crosses as its three channels, opacity dropped`() {
        let washed = ArgoColor(red: 0.2, green: 0.4, blue: 0.6, opacity: 0.3)

        #expect(washed.simd == SIMD3<Float>(0.2, 0.4, 0.6))
    }
}
