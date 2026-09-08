import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Metal
import Testing

/// The one buffer the city's boxes are written into (#1598).
///
/// Its own contract, apart from what a surface update does with it (`AtlasDragTests`): a city that
/// fits is written into the buffer already there, a bigger one grows it, and a map with no boxes
/// draws none without throwing the buffer away. Every claim reads the bytes back, because a `write`
/// that did nothing at all would leave the buffer identical and pass a claim about identity alone.
@Suite("Atlas — the instance buffer", .enabled(if: AtlasPickHarness.isAvailable))
@MainActor
struct AtlasVolumeBufferTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )

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

        // The same tiling nudged: every rect moves, no box is added.
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

    /// A map with no boxes draws none, and does not throw away the buffer on the way: the next
    /// city that has boxes is written into the one already there.
    @Test func `a map with no boxes draws none, and the next one still draws`() throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let city = AtlasVolumes.city(of: AtlasPickingTests.plan(), in: Self.pigments)
        harness.renderer.show(city)
        let buffer = try #require(harness.renderer.instances.buffer)
        let capacity = harness.renderer.instances.capacity

        harness.renderer.show(.empty)

        #expect(harness.renderer.instances.boxes == 0)
        #expect(harness.renderer.instances.buffer === buffer)
        #expect(harness.renderer.instances.capacity == capacity)

        harness.renderer.show(city)

        #expect(harness.renderer.instances.boxes == city.volumes.count)
        #expect(harness.renderer.instances.buffer === buffer)
        try Self.expectHolds(city.volumes, in: harness.renderer.instances)
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
