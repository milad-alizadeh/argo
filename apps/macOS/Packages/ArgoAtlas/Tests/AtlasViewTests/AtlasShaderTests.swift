@testable import AtlasView
import Metal
import Testing

/// The shader this package carries, compiled (#1600).
///
/// **A skip is not a pass.** Every rendering suite here is gated on `AtlasPickHarness.isAvailable`,
/// which asks whether the library has its functions — so a `AtlasVolume.metal` that stopped
/// compiling turns all of them green by skipping, and the whole picture goes unchecked while the
/// run reports no failures. This is the one claim that reds instead, and it names the stage that is
/// missing rather than leaving a reader to bisect a Metal diagnostic.
@Suite(
    "Atlas — the shader this package carries",
    .enabled(if: MTLCreateSystemDefaultDevice() != nil),
)
struct AtlasShaderTests {
    /// Every stage the map is drawn with, by the name a pipeline asks for it by.
    static let stages = [
        "atlas_volume_vertex", "atlas_volume_fragment",
        "atlas_ground_vertex", "atlas_ground_fragment",
        "atlas_floor_vertex", "atlas_floor_fragment",
        "atlas_id_resolve",
    ]

    @Test func `the shader compiles, and carries every stage the map is drawn with`() throws {
        let device = try #require(MTLCreateSystemDefaultDevice())
        let library = try #require(try AtlasVolumeRenderer.compiled(on: device))

        for stage in Self.stages {
            #expect(library.makeFunction(name: stage) != nil, "the shader carries no \(stage)")
        }
    }

    /// And the harness the rendering suites gate on agrees, on a machine that has a device. The
    /// two are one fact read two ways, and the claim above is worth nothing if the trait is
    /// reading something else.
    @Test func `a machine with a device can render the map`() {
        #expect(AtlasPickHarness.isAvailable)
    }
}
