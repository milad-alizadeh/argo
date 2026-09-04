import ArgoDesign
@testable import AtlasView
import Testing

/// The light model, held to the rule stated on `ArgoLight` and on `AtlasVolume.metal`: every term
/// is a scalar multiply on a band's own pigment, never a hue shift, never a wash toward white
/// (#1151).
@Suite("Atlas light — a scalar multiply, never a hue shift")
struct AtlasLightingTests {
    static let palettes = ArgoPalette.all
    static let faces: [(name: String, factor: Float)] = [
        ("roof", AtlasLighting.city.roof),
        ("nearX", AtlasLighting.city.nearX),
        ("nearY", AtlasLighting.city.nearY),
    ]

    /// `AtlasLighting` crosses to the fragment shader as four packed floats — no padding for a
    /// `float2`/`float3` to force, so Swift and Metal agree on this one without help.
    @Test func `the light is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.roof) == 0)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.nearX) == 4)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.nearY) == 8)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.contactFoot) == 12)
        #expect(MemoryLayout<AtlasLighting>.stride == 16)
    }

    /// Every face reads something: the ambient term alone is enough that no face is ever the same
    /// as no light at all. The key is driven above one on purpose — a face it rakes across reads
    /// brighter than its own swatch, not darker — so only the wall it never reaches stays under 1.
    @Test(arguments: faces)
    func `every face is a real, positive term`(_ face: (name: String, factor: Float)) {
        #expect(face.factor > 0)
    }

    /// The rule the ticket names as the one a shader is most likely to break: a lit face's hue is
    /// its band's hue, at every face the fixed yaw ever shows — whether that face reads darker or,
    /// riding the key, brighter than the swatch it was drawn in.
    @Test(arguments: palettes)
    func `a lit face keeps its band's hue, on every face`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for band in appearance.palette.atlas.measure.all {
            for face in Self.faces {
                let lit = band.color.scaled(by: Double(face.factor))
                #expect(lit.hueDistance(to: band.color) < 0.01)
                #expect(lit.red <= 1)
                #expect(lit.green <= 1)
                #expect(lit.blue <= 1)
            }
        }
    }

    /// The lamp direction rakes across on purpose: one visible wall reads mostly key, the other
    /// mostly fill, and the fill is the quieter lamp — so the two walls read at two different
    /// depths of shade rather than going flat together.
    @Test
    func `the two visible walls read at different depths of shade`() {
        #expect(AtlasLighting.city.nearX != AtlasLighting.city.nearY)
        #expect(AtlasLighting.city.roof > max(AtlasLighting.city.nearX, AtlasLighting.city.nearY))
    }
}
