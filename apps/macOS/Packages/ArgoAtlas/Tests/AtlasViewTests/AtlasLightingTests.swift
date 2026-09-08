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

    /// `AtlasLighting` crosses to the vertex shader as four packed floats, a `float2` and a fifth
    /// — and the `float2` is what makes this worth asserting: it aligns to 8 in both languages, so
    /// every offset after it is a padding rule agreeing across two declarations neither side of
    /// which can see the other.
    @Test func `the light is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.roof) == 0)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.nearX) == 4)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.nearY) == 8)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.contactFoot) == 12)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.keyPlan) == 16)
        #expect(MemoryLayout<AtlasLighting>.offset(of: \.sheenFoot) == 24)
        #expect(MemoryLayout<AtlasLighting>.stride == 32)
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

    /// The roof's sheen keeps its band at BOTH ends of itself, AND the grain over the brighter of
    /// them keeps it too (#1600).
    ///
    /// The brightest pixel of a roof is the one every bound here is really about: the face's own
    /// light, times the lit end of the sheen, times the brightest texel of the grain tile. That is
    /// the corner a roof-centre measurement cannot see, so it is measured here — through
    /// `AtlasLighting.city`, which is the value the GPU is handed, rather than through the
    /// contract twice.
    @Test(arguments: palettes)
    func `a roof keeps its band at both ends of the sheen, and under the grain`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let roof = Double(AtlasLighting.city.roof)
        let sheen = Double(AtlasLighting.city.sheenFoot)
        for band in appearance.palette.atlas.measure.all {
            for shade in [roof, roof * sheen] {
                let lit = band.color.scaled(by: shade)
                #expect(lit.hueDistance(to: band.color) < 0.01)
                #expect(lit.distance(to: band.color) < ArgoLight.legendTolerance)
            }
            let dithered = Self.grained(band.color.scaled(by: roof))
            #expect(dithered.hueDistance(to: band.color) < AtlasHue.tolerance)
            #expect(dithered.distance(to: band.color) < ArgoLight.legendTolerance)
        }
    }

    /// The sheen darkens away from the lamp and never brightens past the face's own light — and
    /// the measurement that says why, rather than a sentence in a doc comment.
    ///
    /// The design runs the sheen between these two numbers about the shade a face reads at. Spent
    /// upward on this contract's roof factor, a middling roof and a hot one both land past
    /// `legendTolerance`; pinned, the brightest roof pixel is where the claim above bounds it. The
    /// day `legendTolerance` or the lamps move, this says whether the sheen could brighten again.
    @Test func `the sheen darkens away from the lamp, never brightens past the face`() {
        let measure = ArgoPalette.graphite.atlas.measure
        let roof = Double(AtlasLighting.city.roof)
        let design = (lit: 1.07, far: 0.93)

        #expect(abs(ArgoLight.sheenFoot - design.far / design.lit) < 0.0001)
        #expect(ArgoLight.sheenFoot < 1)
        for band in [measure.middling, measure.hot] {
            #expect(band.scaled(by: roof * design.lit).distance(to: band)
                > ArgoLight.legendTolerance)
            #expect(band.scaled(by: roof).distance(to: band) < ArgoLight.legendTolerance)
        }
    }

    /// One colour through the brightest texel the grain tile holds, on the design's own `overlay`
    /// at `AtlasGround.grain` — the expression `atlas_grain` spends, written once here.
    private static func grained(_ colour: ArgoColor) -> ArgoColor {
        let weight = Double(AtlasGround.grain)
        let noise = Double(AtlasGrain.range.upperBound) / 255
        func over(_ channel: Double) -> Double {
            let lit = channel < 0.5
                ? 2 * channel * noise
                : 1 - 2 * (1 - channel) * (1 - noise)
            return channel + (lit - channel) * weight
        }
        return ArgoColor(red: over(colour.red), green: over(colour.green), blue: over(colour.blue))
    }

    /// The sheen runs along the key's own PLAN direction, and it is the same number every cast
    /// shadow is thrown against — so a roof cannot come out bright on the side its own shadow
    /// falls (`AtlasShadow.decal`).
    @Test func `the sheen runs along the direction the shadows are thrown against`() {
        let plan = AtlasLighting.plan(of: ArgoLight.key)

        #expect(abs(plan.x * plan.x + plan.y * plan.y - 1) < 0.0001)
        #expect(AtlasLighting.city.keyPlan == SIMD2<Float>(Float(plan.x), Float(plan.y)))
        // Overhead and from the reader's left, which `ArgoLightTests` holds the key to: the plan
        // direction keeps that sign, so the bright side of a roof is the -x side.
        #expect(plan.x < 0)
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
