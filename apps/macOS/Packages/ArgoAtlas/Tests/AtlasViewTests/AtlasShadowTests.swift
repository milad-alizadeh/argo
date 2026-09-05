import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The shadow a raised file throws across its own plate — a statement about height, never a
/// second light (#1151).
@Suite("Atlas — the shadow a raised file casts")
struct AtlasShadowTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )
    static let ground = CGRect(x: 0, y: 0, width: 100, height: 100)
    static let plates = [AtlasPlateFrame(path: "a", rect: ground, depth: 0)]

    static func tile(height: CGFloat) -> AtlasTile {
        AtlasTile(
            path: "a/file",
            rect: CGRect(x: 40, y: 40, width: 20, height: 20),
            band: .hot,
            height: height,
        )
    }

    static func decal(height: CGFloat) -> AtlasVolume? {
        AtlasShadow.decal(of: tile(height: height), on: plates, ceiling: 15, in: pigments)
    }

    /// A field of flat files must come out with no shadows in it at all: a file too short to
    /// bother clearing the floor casts nothing, rather than a smudge with nothing standing over
    /// it.
    @Test func `a short file casts nothing`() {
        #expect(Self.decal(height: 0) == nil)
    }

    /// A file tall enough to clear the floor casts something, and what it casts is never black:
    /// a fully shadowed patch is still the plate's own ground, only darker.
    @Test func `a tall file casts a decal, never to black`() throws {
        let decal = try #require(Self.decal(height: 40))

        #expect(decal.shade > 0)
        #expect(decal.shade < 1)
        #expect(decal.pigment == Self.pigments.plate(at: 0).simd)
    }

    /// The throw runs away from the key, on the plan alone — pinned to an ABSOLUTE side rather
    /// than re-derived from the key's own sign. A test written against `key.y > 0` agrees with
    /// the lamp whichever way it points, so it cannot see the day the lamp moves and every shadow
    /// on the map changes side with it. #1400 moved it, and this is what would have said so.
    @Test func `the throw runs away from the key`() throws {
        let decal = try #require(Self.decal(height: 40))

        // The key comes from -x and slightly from -y, so a decal is thrown to +x and +y — off the
        // near corner the camera shows, onto the plate behind the file rather than in front of it.
        #expect(decal.origin.x > 40)
        #expect(decal.origin.y > 40)
    }

    /// A taller caster throws a darker shadow, up to the contract's own floor — the strongest a
    /// shadow is ever allowed to get.
    @Test func `a taller file casts a darker shadow, up to the contract's floor`() throws {
        let short = try #require(Self.decal(height: 1))
        let tall = try #require(Self.decal(height: 40))

        #expect(tall.shade < short.shade)
        #expect(tall.shade >= Float(ArgoLight.shadowDepth))
    }
}
