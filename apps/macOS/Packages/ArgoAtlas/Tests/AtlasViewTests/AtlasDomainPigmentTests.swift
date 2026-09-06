import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// What a region of a map tiled by domain is painted in (#1158).
///
/// The claims are all that the colour came from the promoted WHEEL RULE rather than from a list
/// somebody typed: the count of domains belongs to the repository, so a run of colours long enough
/// is not a thing a contract can hold, and a hard-coded one would wrap the day a repository grew
/// its ninth subject.
@Suite("Atlas — a domain's colour is the wheel's, washed out by how sure we are")
struct AtlasDomainPigmentTests {
    private static let atlas = ArgoPalette.graphite.atlas
    private static let pigments = AtlasPigments(atlas, rim: ArgoPalette.graphite.edge.hairline)

    private static func tile(_ domain: AtlasTileDomain) -> AtlasTile {
        AtlasTile(path: "argo/a.swift", rect: rect, domain: domain, height: 4)
    }

    /// The other reading of the same rectangle: a file on a map tiled by folder, painted by what
    /// it measures.
    private static func measured(_ band: AtlasBand?) -> AtlasTile {
        AtlasTile(path: "argo/a.swift", rect: rect, band: band, height: 4)
    }

    private static let rect = CGRect(x: 0, y: 0, width: 10, height: 10)

    @Test(arguments: [0, 1, 7, 40]) func `a region takes the wheel's own hue at its rank`(
        rank: Int,
    ) {
        // The rule, not a list: the wheel walks the golden angle from the rank, so the fortieth
        // domain has a colour without anything having enumerated forty of them.
        #expect(
            Self.pigments.pigment(of: Self.tile(.placed(rank: rank, confidence: 1)))
                == Self.atlas.domain.hue(rank, confidence: 1),
        )
    }

    @Test func `a domain we are unsure of arrives washed out, in the same place on the wheel`() {
        // Confidence rides on SATURATION. Moving the hue instead would make an unsure file read as
        // a different subject rather than as a weaker claim about this one.
        let sure = Self.pigments.pigment(of: Self.tile(.placed(rank: 3, confidence: 1)))
        let unsure = Self.pigments.pigment(of: Self.tile(.placed(rank: 3, confidence: 0.2)))

        #expect(AtlasHue(unsure).degrees == AtlasHue(sure).degrees)
        #expect(unsure != sure)
    }

    @Test func `a file that belongs to nothing is the one grey, not the wheel run down`() {
        // An unassigned file is not a weaker domain, so it is not the wheel at zero confidence —
        // that is still a hue, and a hue would make it read as one more subject.
        let loose = Self.pigments.pigment(of: Self.tile(.unassigned))

        #expect(loose == Self.atlas.materials.unassigned)
        #expect(loose != Self.atlas.domain.hue(0, confidence: 0))
    }

    @Test func `the band still paints a map tiled by folder`() {
        // The other half of the switch, and the one a domain rank must not reach: a tile with no
        // Domain is a tile on the measured reading, and its colour is what it measures.
        #expect(
            Self.pigments.pigment(of: Self.measured(.hot)) == Self.atlas.measure.hot,
        )
        #expect(
            Self.pigments.pigment(of: Self.measured(nil))
                == Self.atlas.materials.unassigned,
        )
    }

    @Test func `the volumes are painted by domain where the tiles carry one`() {
        // The seam the GPU is actually handed. Asserting only on `AtlasPigments` would leave the
        // one place that matters — what reaches the shader — free to go on reading the band.
        let plan = AtlasPlan(
            extent: CGSize(width: 100, height: 100),
            plates: [
                .init(path: "argo", rect: CGRect(x: 0, y: 0, width: 100, height: 100), depth: 0),
            ],
            tiles: [
                .init(
                    path: "argo/a.swift",
                    rect: CGRect(x: 2, y: 14, width: 46, height: 40),
                    domain: .placed(rank: 2, confidence: 0.75),
                    height: 10,
                ),
            ],
        )
        let city = AtlasVolumes.city(of: plan, in: Self.pigments)

        #expect(city.volumes.last?.pigment == Self.atlas.domain.hue(2, confidence: 0.75).simd)
    }
}
