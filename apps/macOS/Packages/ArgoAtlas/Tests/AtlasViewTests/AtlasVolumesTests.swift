import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// What the map is painted in, checked without a GPU.
///
/// Every claim here is one a screenshot would have to be eyedropped to make, and one that decides
/// whether the picture is honest rather than whether it is pretty: a file is its band's own swatch
/// and nothing else, an unmeasured file is not the quiet end of the ramp, and the order the volumes
/// are handed over is the order that puts a file on top of the plate it stands on.
@Suite("Atlas — what the map is painted in")
struct AtlasVolumesTests {
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
                    height: 40,
                ),
                .init(
                    path: "a/two",
                    rect: CGRect(x: 50, y: 14, width: 50, height: 86),
                    band: nil,
                    height: 3,
                ),
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
    /// Two faces per plate: its rim, then its ground inside that. Then a shadow decal per tile
    /// tall enough to cast one — both of the fixture's files clear the floor — landing after
    /// every plate and before every file, so a file standing where its own shadow falls draws
    /// over it (#1151).
    @Test func `the plates are handed over before the files that stand on them`() {
        let volumes = AtlasVolumes.city(of: Self.plan(), in: Self.pigments).volumes

        #expect(volumes.count == 8)
        #expect(volumes[0].pigment == Self.pigments.rim(at: 0).simd)
        #expect(volumes[1].pigment == Self.pigments.plate(at: 0).simd)
        #expect(volumes[2].pigment == Self.pigments.rim(at: 1).simd)
        #expect(volumes[3].pigment == Self.pigments.plate(at: 1).simd)
        #expect(volumes[4].shade < 1)
        #expect(volumes[5].shade < 1)
        #expect(volumes[6].pigment == Self.measure.hot.simd)
        #expect(volumes[7].pigment == ArgoPalette.graphite.atlas.materials.unassigned.simd)
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
        let volumes = AtlasVolumes.city(of: Self.plan(), in: Self.pigments).volumes
        let border = Float(AtlasVolumes.border)

        #expect(volumes[0].size == SIMD2<Float>(100, 100))
        #expect(volumes[1].origin == SIMD2<Float>(border, border))
        #expect(volumes[1].size == SIMD2<Float>(100 - border * 2, 100 - border * 2))
    }

    /// A file keeps a gap of the plate around it, so a treemap reads as rectangles rather than as
    /// one field of colour.
    @Test func `a file keeps a gap around itself`() {
        let gap = Float(AtlasVolumes.gap)

        let volumes = AtlasVolumes.city(of: Self.plan(), in: Self.pigments).volumes

        #expect(volumes[6].origin == SIMD2<Float>(2 + gap, 28 + gap))
        #expect(volumes[6].size == SIMD2<Float>(46 - gap * 2, 40 - gap * 2))
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

        let face = try #require(AtlasVolumes.city(of: plan, in: Self.pigments).volumes.first)

        #expect(face.origin.x.isFinite)
        #expect(face.size == SIMD2<Float>(0, 0))
    }

    /// A file stands as tall as the plan said it stands, and its foot is on the plate — the third
    /// channel, arriving at the GPU as the one number the shader raises the roof by.
    @Test func `a file's roof stands at the height the plan gave it`() {
        let volumes = AtlasVolumes.city(of: Self.plan(), in: Self.pigments).volumes

        #expect(volumes[6].heights == SIMD2<Float>(0, 40))
        #expect(volumes[7].heights == SIMD2<Float>(0, 3))
    }

    /// The id a pick reads back names the box it was drawn for, and NOTHING is a real answer with
    /// a number of its own: 0, which on a drawn map nothing carries — it is the desktop (#1153).
    ///
    /// A folder carries one too since #1156, on both of its faces — the rim and the ground — so
    /// the margin the tiler leaves round a folder's contents is the folder's own target. The two
    /// plates are ids 1 and 2 here, the two files 3 and 4, which is the roster's own order.
    @Test func `every file and every folder carries an id, and it names that box`() {
        let plan = Self.plan()

        let city = AtlasVolumes.city(of: plan, in: Self.pigments)

        #expect(city.volumes.prefix(2).allSatisfy { $0.id == 1 })
        #expect(city.volumes[2 ... 3].allSatisfy { $0.id == 2 })
        #expect(city.volumes[6].id == 3)
        #expect(city.volumes[7].id == 4)
        #expect(city.target(at: 1) == .folder("a"))
        #expect(city.target(at: 2) == .folder("a/b"))
        #expect(city.file(at: 3) == "a/b/one")
        #expect(city.file(at: 4) == "a/two")
    }

    /// A cast shadow lies ON a folder's ground, is painted in that ground's tone, and is picked as
    /// that folder (#1156).
    ///
    /// The claim is about a hole rather than about a shadow: a decal is drawn after the plate and
    /// coplanar with it, so an unidentified one writes 0 over the plate's id and leaves a patch of
    /// the folder's margin that descends into nothing — invisible at the flat camera, where the
    /// shader fades the decal out but the tiler still places it.
    @Test func `a cast shadow is picked as the folder whose ground it lies on`() {
        let city = AtlasVolumes.city(of: Self.plan(), in: Self.pigments)

        // Four plate faces, then the decals, then the two files: the order `city` builds them in.
        let shadows = city.volumes.dropFirst(4).dropLast(2)
        #expect(!shadows.isEmpty, "no file in the fixture is tall enough to cast anything")
        // Every decal names a folder rather than nothing, and the folder it names is one of the
        // two plates — never a file, which would trace a reading over a shadow.
        #expect(shadows.allSatisfy { $0.id > 0 })
        for shadow in shadows {
            let named = city.target(at: shadow.id)
            #expect(
                named == .folder("a") || named == .folder("a/b"),
                "a decal named \(named as Any)",
            )
        }
        // The tall file stands on the nested plate, so the decal it throws is that plate's.
        #expect(city.target(at: shadows.first?.id ?? 0) == .folder("a/b"))
    }

    /// The hover names files and only files: the strip over the map is built to say a filename,
    /// and a folder read into it would caption the map with something it cannot say.
    @Test func `a folder is picked, and is not a file`() {
        let city = AtlasVolumes.city(of: Self.plan(), in: Self.pigments)

        #expect(city.file(at: 1) == nil)
        #expect(city.target(at: 3) == .file("a/b/one"))
    }

    /// A point on no box resolves to nothing rather than to the nearest — the claim spelled at the
    /// one place it is decided. An id past the roster is a target drawn from an older map than the
    /// one being asked; it too is nothing, because naming a file off a stale frame is exactly the
    /// answer this whole mechanism exists to make impossible.
    @Test func `an id that names nothing resolves to nothing`() {
        let city = AtlasVolumes.city(of: Self.plan(), in: Self.pigments)

        #expect(city.target(at: 0) == nil)
        #expect(city.target(at: 5) == nil)
        #expect(city.target(at: .max) == nil)
    }

    /// A PLATE is foot and roof at one height. It is what makes the ground a flat face rather than
    /// a slab: its two walls come out degenerate and rasterise nothing, so a plate costs the same
    /// one quad it cost flat.
    @Test func `a plate is one flat face, foot and roof together`() {
        let volumes = AtlasVolumes.city(of: Self.plan(), in: Self.pigments).volumes

        #expect(volumes.prefix(4).allSatisfy { $0.heights.x == $0.heights.y })
    }
}
