import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Metal
import Testing

/// A drag frame draws the boxes that are already on the GPU (#1598).
///
/// The other half of the claim is `AtlasCityCacheTests`, which says the city is not built again.
/// This half says what happens on the GPU when it is not: the picture changes, because the eye and
/// the rise are pushed on their own; and the instance buffer is the same object it was, because
/// nothing wrote one. Both are needed — a drag that allocated nothing and drew the same picture
/// twice would pass either one alone.
@Suite("Atlas — a drag frame", .enabled(if: AtlasPickHarness.isAvailable))
@MainActor
struct AtlasDragTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )

    static func camera(of plan: AtlasPlan, yaw: Double) -> AtlasCamera {
        AtlasCamera(
            relief: 1,
            orientation: AtlasOrientation(yaw: yaw, pitch: 0.6155),
            over: plan.extent,
        )
    }

    /// THE CLAIM. A map pushed once, then turned through twelve frames: the picture is a different
    /// one at the end, and the boxes it was drawn from are in the buffer they started in.
    @Test func `a turn redraws the map from the boxes already on the GPU`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()

        let opening = try #require(await harness.frame(
            of: AtlasVolumes.city(of: plan, in: Self.pigments),
            plan: plan,
            through: Self.camera(of: plan, yaw: 0),
        ))
        let buffer = try #require(harness.renderer.instances.buffer)
        let boxes = harness.renderer.instances.boxes

        var latest: AtlasFrame?
        for step in 1 ... 12 {
            latest = await harness.frame(
                of: plan, through: Self.camera(of: plan, yaw: Double(step) * 0.08),
            )
        }
        let turned = try #require(latest)

        // The eye reached the GPU on its own: the city never moved and the picture did.
        #expect(turned.colour != opening.colour)
        // And it reached it without a second buffer: `===`, so a fresh allocation holding the same
        // bytes would fail this.
        #expect(harness.renderer.instances.buffer === buffer)
        #expect(harness.renderer.instances.boxes == boxes)
        #expect(harness.renderer.instances.capacity == boxes)
    }

    /// A re-tile of the same repository is a new city of the same size, and it is written into the
    /// buffer that is already there rather than into a fresh one.
    ///
    /// The bytes are read back, because a `write` that did nothing at all would leave the buffer
    /// identical and pass a claim about identity alone.
    @Test func `a city that fits is written into the buffer already there`() throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()
        harness.renderer.show(AtlasVolumes.city(of: plan, in: Self.pigments))
        let buffer = try #require(harness.renderer.instances.buffer)

        // The same tiling, framed into a window the same size — every rect moves, no box is added.
        let retiled = AtlasVolumes.city(
            of: AtlasPlan(
                extent: plan.extent,
                plates: plan.plates,
                tiles: plan.tiles.map {
                    AtlasTile(
                        path: $0.path,
                        rect: $0.rect.offsetBy(dx: 1, dy: 1),
                        band: $0.band,
                        height: $0.height,
                    )
                },
            ),
            in: Self.pigments,
        )
        harness.renderer.show(retiled)

        #expect(harness.renderer.instances.buffer === buffer)
        #expect(harness.renderer.instances.boxes == retiled.volumes.count)
        try Self.expectHolds(retiled.volumes, in: harness.renderer.instances)
    }

    /// A city with more boxes than the buffer holds grows it, and what it grew to holds the new
    /// city rather than the old one's tail.
    @Test func `a bigger city grows the buffer and holds every box of it`() throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let small = AtlasVolumes.city(of: AtlasCityCacheTests.plan(), in: Self.pigments)
        harness.renderer.show(small)
        let first = try #require(harness.renderer.instances.buffer)

        let big = AtlasVolumes.city(of: AtlasPickingTests.plan(), in: Self.pigments)
        #expect(big.volumes.count > small.volumes.count, "the fixtures no longer differ in size")
        harness.renderer.show(big)

        #expect(harness.renderer.instances.buffer !== first)
        #expect(harness.renderer.instances.capacity == big.volumes.count)
        try Self.expectHolds(big.volumes, in: harness.renderer.instances)
    }

    /// A map with no boxes in it draws none: the count goes to nothing, so the pass encodes
    /// nothing rather than drawing whatever the buffer held before.
    @Test func `a map with no boxes draws none`() throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        harness.renderer.show(AtlasVolumes.city(of: AtlasPickingTests.plan(), in: Self.pigments))

        harness.renderer.show(.empty)

        #expect(harness.renderer.instances.boxes == 0)
    }

    /// What the buffer is actually holding, box for box.
    private static func expectHolds(
        _ volumes: [AtlasVolume],
        in instances: AtlasVolumeBuffer,
    ) throws {
        let contents = try #require(instances.buffer?.contents())
        let held = contents.bindMemory(to: AtlasVolume.self, capacity: volumes.count)
        for (index, volume) in volumes.enumerated() {
            #expect(held[index].origin == volume.origin)
            #expect(held[index].size == volume.size)
            #expect(held[index].heights == volume.heights)
            #expect(held[index].id == volume.id)
            #expect(held[index].pigment == volume.pigment)
        }
    }
}
