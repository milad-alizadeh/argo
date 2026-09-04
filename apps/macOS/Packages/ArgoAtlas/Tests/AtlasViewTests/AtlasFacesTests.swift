import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// What the map is painted in, checked without a GPU.
///
/// Every claim here is one a screenshot would have to be eyedropped to make, and one that decides
/// whether the picture is honest rather than whether it is pretty: a file is its band's own swatch
/// and nothing else, an unmeasured file is not the quiet end of the ramp, and the order the faces
/// are handed over is the order that puts a file on top of the plate it stands on.
@Suite("Atlas — what the map is painted in")
struct AtlasFacesTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )
    static let measure = ArgoPalette.graphite.atlas.measure

    static func plan() -> AtlasPlan {
        AtlasPlan(
            extent: CGSize(width: 100, height: 100),
            plates: [
                .init(path: "a", rect: CGRect(x: 0, y: 0, width: 100, height: 100), depth: 0),
                .init(path: "a/b", rect: CGRect(x: 0, y: 14, width: 50, height: 86), depth: 1),
            ],
            tiles: [
                .init(
                    path: "a/b/one",
                    rect: CGRect(x: 2, y: 28, width: 46, height: 40),
                    band: .hot,
                ),
                .init(path: "a/two", rect: CGRect(x: 50, y: 14, width: 50, height: 86), band: nil),
            ],
        )
    }

    /// The design's own rule, made a claim: NOTHING MAY BE LIT AT THE COST OF ITS BAND. Flat, that
    /// means the number reaching the GPU is the swatch's own, with no lamp multiplied into it — so
    /// this compares the face against the contract's role rather than against a scaled copy.
    @Test(arguments: [AtlasBand.quiet, .middling, .hot])
    func `a file is drawn in its band's own swatch, unlit`(band: AtlasBand) {
        let painted = Self.pigments.pigment(of: band)

        let expected: [AtlasBand: ArgoColor] = [
            .quiet: Self.measure.quiet, .middling: Self.measure.middling, .hot: Self.measure.hot,
        ]
        #expect(painted == expected[band])
    }

    /// Unmeasured is not the least of something. A file the repository carries no value for is
    /// drawn the material grey, because a green rectangle would put a claim on the map that no
    /// number stands behind.
    @Test func `a file the repository never measured is grey, not quiet`() {
        let materials = ArgoPalette.graphite.atlas.materials

        #expect(Self.pigments.pigment(of: nil) == materials.unassigned)
        #expect(Self.pigments.pigment(of: nil) != Self.measure.quiet)
    }

    /// Three tones and the deepest repeated, which is what the eye reads off a tone. The fixture
    /// nests eleven levels; eleven greys would be eleven greys nobody can order.
    @Test func `a plate deeper than the contract's tones keeps the deepest`() {
        let materials = ArgoPalette.graphite.atlas.materials

        #expect(Self.pigments.plate(at: 0) == materials.plate1)
        #expect(Self.pigments.plate(at: 1) == materials.plate2)
        #expect(Self.pigments.plate(at: 2) == materials.plate3)
        #expect(Self.pigments.plate(at: 11) == materials.plate3)
    }

    /// The painter's order. A nested plate covers the one it stands on and a file covers the plate
    /// it stands on, so the plates come first and outermost first — which is the order the plan
    /// already holds them in, and this is the claim that nothing here re-sorts it.
    ///
    /// Two faces per plate: its rim, then its ground inside that.
    @Test func `the plates are handed over before the files that stand on them`() {
        let faces = AtlasFaces.faces(of: Self.plan(), in: Self.pigments)

        #expect(faces.count == 6)
        #expect(faces[0].pigment == Self.pigments.rim(at: 0).simd)
        #expect(faces[1].pigment == Self.pigments.plate(at: 0).simd)
        #expect(faces[2].pigment == Self.pigments.rim(at: 1).simd)
        #expect(faces[3].pigment == Self.pigments.plate(at: 1).simd)
        #expect(faces[4].pigment == Self.measure.hot.simd)
        #expect(faces[5].pigment == ArgoPalette.graphite.atlas.materials.unassigned.simd)
    }

    /// The shader does not blend, so a role carrying an opacity has to be resolved before it gets
    /// there. `edge.hairline` is white at 8%: handed over as-is it arrives WHITE, which is a
    /// border drawn at twelve times the weight the contract asked for and the brightest thing on
    /// the map.
    @Test func `a plate's border arrives resolved against the ground it lies on`() {
        let hairline = ArgoPalette.graphite.edge.hairline

        #expect(Self.pigments.rim(at: 0).opacity == 1)
        #expect(Self.pigments.rim(at: 0) != hairline)
        #expect(Self.pigments.rim(at: 0)
            == hairline.composited(over: ArgoPalette.graphite.atlas.materials.desktop))
        // The ground a border lies on is the plate BELOW it, not its own.
        #expect(Self.pigments.rim(at: 2)
            == hairline.composited(over: Self.pigments.plate(at: 1)))
    }

    /// The border is what tells one plate from the next once the contract's three tones have run
    /// out, which the fixture's nesting reaches. A rim under the ground rather than a stroke over
    /// it, so it costs the map no face nothing stands on.
    @Test func `a plate's ground sits inside its own rim`() {
        let faces = AtlasFaces.faces(of: Self.plan(), in: Self.pigments)
        let border = Float(AtlasFaces.border)

        #expect(faces[0].size == SIMD2<Float>(100, 100))
        #expect(faces[1].origin == SIMD2<Float>(border, border))
        #expect(faces[1].size == SIMD2<Float>(100 - border * 2, 100 - border * 2))
    }

    /// A file keeps a gap of the plate around it, so a treemap reads as rectangles rather than as
    /// one field of colour.
    @Test func `a file keeps a gap around itself`() {
        let gap = Float(AtlasFaces.gap)

        let faces = AtlasFaces.faces(of: Self.plan(), in: Self.pigments)

        #expect(faces[4].origin == SIMD2<Float>(2 + gap, 28 + gap))
        #expect(faces[4].size == SIMD2<Float>(46 - gap * 2, 40 - gap * 2))
    }

    /// The gap may not turn a small file into a face covering the map. `CGRect.insetBy` returns a
    /// NULL rectangle once the inset eats the whole width, and a null rectangle's origin is
    /// infinite — which the GPU would draw over everything.
    @Test func `a file too small for its own gap stays where it is`() throws {
        let plan = AtlasPlan(
            extent: CGSize(width: 100, height: 100),
            tiles: [.init(
                path: "thread",
                rect: CGRect(x: 10, y: 10, width: 0.2, height: 0.2),
                band: .quiet,
            )],
        )

        let face = try #require(AtlasFaces.faces(of: plan, in: Self.pigments).first)

        #expect(face.origin.x.isFinite)
        #expect(face.size == SIMD2<Float>(0, 0))
    }
}
