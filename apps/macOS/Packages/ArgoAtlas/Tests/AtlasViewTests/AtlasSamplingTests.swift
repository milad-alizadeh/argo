@testable import AtlasView
import Metal
import Testing

/// What the city's edges are resolved from (#1400).
///
/// Every edge in this picture is a box's own silhouette against whatever stands behind it — there
/// is no texture and no wireframe to hide a staircase in — so how many samples a pixel is resolved
/// from IS the edge quality, and it is the only part of the renderer a test can reach: `init` also
/// wants a command queue and a compiled shader library, and a test process has neither.
///
/// Gated on the machine having a GPU at all, which is the same answer `AtlasVolumeRenderer.init`
/// gives: a box with no Metal device skips rather than fails.
@Suite("Atlas sampling — the city's edges are resolved, not stepped")
struct AtlasSamplingTests {
    /// The point of the whole change: more than one sample a pixel, and a count the device
    /// actually agreed to. A preference the pass cannot honour is a pass that does not draw, so
    /// asking is not optional — but four is what every Metal device on this platform supports,
    /// which is what makes it the one worth asking for.
    @Test func `the city is drawn at every sample the device will give`() throws {
        let device = try #require(MTLCreateSystemDefaultDevice())
        let samples = AtlasVolumeRenderer.sampleCount(on: device)

        #expect(device.supportsTextureSampleCount(samples))
        #expect(samples > 1)
        #expect(samples == AtlasVolumeRenderer.preferredSampleCount)
    }
}
