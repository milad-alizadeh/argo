import ArgoDesign
import AtlasLayout
@testable import AtlasView
import Foundation
import simd
import Testing

/// The orbit ball is the model, not an icon of it (#1152): a lit sphere under the map's own lamps,
/// turned by the same two angles the city is. These are the claims that make it a READOUT rather
/// than a picture — that turning the model moves the light and the plan, and that what comes out is
/// the map's own pigment lit, never a hue the legend does not name.
@Suite("Atlas orbit — the model, turned")
struct AtlasOrbitShadingTests {
    static let pigment = ArgoTheme.graphite.color.atlas.materials.unassigned

    private static func shading(yaw: Double, pitch: Double = 0.6155) -> AtlasOrbitShading {
        AtlasOrbitShading(
            orientation: AtlasOrientation(yaw: yaw, pitch: pitch), pigment: pigment,
        )
    }

    /// A rotation, so the three axes stay unit-length and square to each other at every angle. A
    /// basis that drifted would light the ball by a lamp that had grown or shrunk on the way in.
    @Test(arguments: [0.0, 0.4, 1.0, 2.5, .pi])
    func `the basis is a rotation at any yaw`(yaw: Double) {
        let basis = Self.shading(yaw: yaw).basis
        for axis in [basis.right, basis.up, basis.toward] {
            #expect(abs(simd_length(axis) - 1) < 1e-9)
        }
        #expect(abs(dot(basis.right, basis.up)) < 1e-9)
        #expect(abs(dot(basis.right, basis.toward)) < 1e-9)
        #expect(abs(dot(basis.up, basis.toward)) < 1e-9)
    }

    /// The disc fills its own silhouette and nothing outside it: the corners are clear, the centre
    /// is opaque. Anything else is a square control wearing a round mask.
    @Test func `the ball is a disc, not a square`() throws {
        let size = 54
        let image = try #require(Self.shading(yaw: .pi / 4).ball(diameter: size))
        #expect(image.width == size)
        #expect(image.height == size)
        let pixels = try #require(image.dataProvider?.data as Data?)
        #expect(pixels[3] == 0)
        #expect(pixels[(size * size / 2 + size / 2) * 4 + 3] == 255)
    }

    /// The lamps are fixed in the MODEL, so the highlight travels as the reader turns the ball —
    /// which is the whole reason the handle is a sphere and not a symbol. A quarter-turn has to
    /// move where the brightest pixel sits.
    @Test func `turning the model moves the highlight`() throws {
        let size = 54
        let straight = try #require(brightestColumn(of: Self.shading(yaw: 0), diameter: size))
        let turned = try #require(brightestColumn(of: Self.shading(yaw: .pi / 2), diameter: size))
        #expect(straight != turned)
    }

    /// Every pixel is the pigment SCALED — `ArgoLight`'s absolute rule. A lit sphere that drifted
    /// off the hue would be painting a band the legend never names, so the ratios between the
    /// channels hold everywhere the disc is opaque.
    @Test func `the ball is one pigment, lit`() throws {
        let size = 54
        let image = try #require(Self.shading(yaw: .pi / 4).ball(diameter: size))
        let pixels = try #require(image.dataProvider?.data as Data?)
        let ratio = Self.pigment.red / Self.pigment.green
        for index in stride(from: 0, to: size * size * 4, by: 4) where pixels[index + 3] == 255 {
            let red = Double(pixels[index]), green = Double(pixels[index + 1])
            // Two 8-bit channels rounded independently can disagree by a step at either end.
            #expect(abs(red - green * ratio) <= 2)
        }
    }

    /// The plan square turns with the model and one corner is marked, so a half-turn of the city
    /// is visible on the handle: the marked corner has to swap which side of the ball it is on.
    @Test func `the plan turns with the model`() {
        let near = Self.shading(yaw: 0).planCorners(radius: 27)
        let round = Self.shading(yaw: .pi).planCorners(radius: 27)
        #expect(near[0].depth * round[0].depth < 0)
    }

    /// Which column of the disc carries its brightest pixel.
    private func brightestColumn(of shading: AtlasOrbitShading, diameter: Int) -> Int? {
        guard let image = shading.ball(diameter: diameter),
              let pixels = image.dataProvider?.data as Data? else { return nil }
        var best = 0, column: Int?
        for row in 0 ..< diameter {
            for index in 0 ..< diameter {
                let offset = (row * diameter + index) * 4
                guard pixels[offset + 3] == 255, Int(pixels[offset]) > best else { continue }
                best = Int(pixels[offset])
                column = index
            }
        }
        return column
    }
}
