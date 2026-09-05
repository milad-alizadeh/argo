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
    /// as no light at all.
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

    /// The lamp direction rakes across on purpose: the roof reads brightest, then the wall the key
    /// rakes, then the wall the fill lifts. They have to STEP, not merely differ — two faces a
    /// rounding error apart meet at an edge no reader can see, and a city of those reads flat
    /// however many boxes stand in it (#1400). `ArgoLight.faceStep` is the least ratio an edge is
    /// visible at, and every adjacent pair has to clear it. The ordering falls out of the ratios,
    /// so it is not asserted twice.
    @Test
    func `each face steps clear of the next`() {
        let ordered = [
            AtlasLighting.city.roof, AtlasLighting.city.nearX, AtlasLighting.city.nearY,
        ]
        for (brighter, darker) in zip(ordered, ordered.dropFirst()) {
            #expect(Double(brighter / darker) >= ArgoLight.faceStep)
        }
    }

    /// The roof is what the legend is held against — the flat swatch beside a map whose roofs are
    /// fully lit — and `ArgoLight.legendTolerance` is the stated bound on how far apart they may
    /// read: never exact, since the roof rides the key's own brightening and the legend does not
    /// track `relief`, but never far enough to look like a different band.
    @Test(arguments: palettes)
    func `a lit roof stays within the legend's stated tolerance`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for band in appearance.palette.atlas.measure.all {
            let lit = band.color.scaled(by: Double(AtlasLighting.city.roof))
            #expect(lit.distance(to: band.color) < ArgoLight.legendTolerance)
        }
    }
}
