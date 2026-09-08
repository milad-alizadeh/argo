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

    /// The roof's sheen keeps its band, at BOTH ends of itself (#1600). It is a scalar across the
    /// one face, so the far side of a roof is the same colour as its lit side and as the swatch —
    /// only darker.
    @Test(arguments: palettes)
    func `the roof's sheen keeps its band's hue at both ends`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let roof = Double(AtlasLighting.city.roof)
        for band in appearance.palette.atlas.measure.all {
            for shade in [roof, roof * ArgoLight.sheenFoot] {
                let lit = band.color.scaled(by: shade)
                #expect(lit.hueDistance(to: band.color) < 0.01)
                #expect(lit.distance(to: band.color) < ArgoLight.legendTolerance)
            }
        }
    }

    /// WHY the sheen is pinned to the face's own light rather than centred on it, as a measurement
    /// rather than as a doc comment.
    ///
    /// The design runs the sheen 1.07 against 0.93 about the shade a face reads at. Spent that way
    /// on this contract's own roof factor, the lit side of a hot roof lands past
    /// `legendTolerance` — so the RATIO across the roof is the design's and the lit end is the
    /// face's light, which leaves the brightest roof pixel exactly where the claim above already
    /// bounds it. The day `legendTolerance` or the lamps move, this says whether the sheen could
    /// go back to brightening.
    @Test func `brightening the sheen instead would take a roof off its own swatch`() {
        let hot = ArgoPalette.graphite.atlas.measure.hot
        let roof = Double(AtlasLighting.city.roof)
        // The design's lit end: the same ratio, spent upward instead of downward.
        let brightened = hot.scaled(by: roof / ArgoLight.sheenFoot)

        #expect(brightened.distance(to: hot) > ArgoLight.legendTolerance)
        #expect(hot.scaled(by: roof).distance(to: hot) < ArgoLight.legendTolerance)
        #expect(ArgoLight.sheenFoot < 1)
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
