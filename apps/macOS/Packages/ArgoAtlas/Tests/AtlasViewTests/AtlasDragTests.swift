import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Metal
import Testing

/// What one update of the surface does on the GPU (#1598).
///
/// Everything here drives `AtlasVolumeRenderer.present`, which is the whole of what
/// `AtlasSurface.apply(to:coordinator:)` calls — so a surface that went back to rebuilding the city
/// on every update would have to go through this, and a test that hand-rolled the two pushes would
/// not have said so.
///
/// The claim splits in two and needs both halves. That a drag rebuilds NO city is
/// `AtlasCityCacheTests`: `present` reaches `show` only through a non-nil answer from the cache,
/// and
/// the cache provably answers nothing for a drag's inputs. That the eye still reaches the GPU
/// without it — and that a map which really did change still reaches the screen — is here, because
/// a drag that allocated nothing and drew a frozen picture would satisfy the first half alone.
@Suite("Atlas — one update of the surface", .enabled(if: AtlasPickHarness.isAvailable))
@MainActor
struct AtlasDragTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )

    /// A grid of banded files on one plate, tall enough to have a skyline — the same fixture the
    /// picking sweep renders, because a map that draws is what these claims are about.
    static func plan() -> AtlasPlan {
        AtlasPickingTests.plan()
    }

    static func projection(of plan: AtlasPlan, yaw: Double) -> AtlasProjection {
        AtlasProjection(
            of: plan,
            through: AtlasCamera(
                relief: 1,
                orientation: AtlasOrientation(yaw: yaw, pitch: 0.6155),
                over: plan.extent,
            ),
        )
    }

    /// THE CLAIM's other half. Twelve frames of a drag through the surface's own call: the picture
    /// is a different one at the end, and the boxes it was drawn from are in the buffer they
    /// started in — the same object, so a fresh allocation holding the same bytes would fail this.
    @Test func `a drag redraws the map from the boxes already on the GPU`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = Self.plan()

        harness.renderer.present(Self.projection(of: plan, yaw: 0), in: Self.pigments)
        let opening = try #require(await harness.frame())
        let buffer = try #require(harness.renderer.instances.buffer)
        let boxes = harness.renderer.instances.boxes

        var latest: AtlasFrame?
        for step in 1 ... 12 {
            harness.renderer.present(
                Self.projection(of: plan, yaw: Double(step) * 0.08), in: Self.pigments,
            )
            latest = await harness.frame()
        }
        let turned = try #require(latest)

        #expect(turned.colour != opening.colour)
        #expect(harness.renderer.instances.buffer === buffer)
        #expect(harness.renderer.instances.boxes == boxes)
        #expect(harness.renderer.instances.capacity == boxes)
    }

    /// A pigment change still redraws the map. Through the same call and at the SAME camera, so
    /// the only thing that can have moved the picture is the paint — which is what makes this the
    /// claim that the map is still rebuilt when it has to be, rather than never.
    @Test func `a pigment change redraws the map`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = Self.plan()
        let projection = Self.projection(of: plan, yaw: 0)

        harness.renderer.present(projection, in: Self.pigments)
        let before = try #require(await harness.frame())

        harness.renderer.present(projection, in: AtlasCityCacheTests.repainted)
        let after = try #require(await harness.frame())

        #expect(after.colour != before.colour)
        // The bands swapped ends rather than the picture merely differing somewhere.
        #expect(Self.bands(in: after) == Self.bands(in: before).map(Self.swapped))
    }

    /// A re-tile still redraws the map: the same repository framed into a window of another size
    /// is a plan whose every box has moved, and a city the renderer kept would draw the old one.
    @Test func `a re-tile redraws the map`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasCityCacheTests.plan()
        let retiled = AtlasCityCacheTests.plan(extent: CGSize(width: 320, height: 150))

        harness.renderer.present(Self.projection(of: plan, yaw: 0), in: Self.pigments)
        let before = try #require(await harness.frame())

        harness.renderer.present(Self.projection(of: retiled, yaw: 0), in: Self.pigments)
        let after = try #require(await harness.frame())

        #expect(after.colour != before.colour)
        #expect(harness.renderer.instances.boxes
            == AtlasVolumes.city(of: retiled, in: Self.pigments).volumes.count)
    }

    /// The shadows a raised file throws reach the SCREEN, which is the one thing the plate index
    /// could break silently: a decal placed on the wrong plate is painted in the wrong tone, and a
    /// decal placed nowhere is not painted at all. Rendered twice, once with the decals taken out.
    @Test func `the cast shadows are drawn`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = Self.plan()
        let city = AtlasVolumes.city(of: plan, in: Self.pigments)
        // A cast decal is the only box on the map carrying a baked darkening (#1151).
        let decals = city.volumes.filter { $0.shade < 1 }
        #expect(!decals.isEmpty, "no file in the fixture is tall enough to cast anything")
        // The floor is carried over unchanged (#1600): the only difference between the two
        // renders has to be the decals, and a city built without a table would differ by the
        // whole ground as well.
        let unshadowed = AtlasCity(
            volumes: city.volumes.filter { $0.shade >= 1 },
            roster: city.roster,
            patches: city.patches,
            ground: city.ground,
        )
        let camera = AtlasCamera(relief: 1, orientation: .opening, over: plan.extent)

        let withShadows = try #require(await harness.frame(
            of: city, plan: plan, through: camera,
        ))
        let without = try #require(await harness.frame(
            of: unshadowed, plan: plan, through: camera,
        ))

        #expect(withShadows.colour != without.colour)
    }

    /// Which band each of the frame's sampled pixels is painted in — the picture read back as the
    /// ramp, which is what tells a repaint from any other difference.
    private static func bands(in frame: AtlasFrame) -> [AtlasBand?] {
        Swift.stride(
            from: 0,
            to: AtlasPickHarness.size.width * AtlasPickHarness.size.height,
            by: AtlasPickingTests.step,
        ).map { frame.band(atPixel: $0) }
    }

    /// The ends of the ramp swapped, which is what `AtlasCityCacheTests.repainted` does to it.
    private static func swapped(_ band: AtlasBand?) -> AtlasBand? {
        switch band {
        case .quiet: .hot
        case .hot: .quiet
        case .middling: .middling
        case nil: nil
        }
    }
}
