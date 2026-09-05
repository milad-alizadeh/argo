@testable import AtlasView
import Metal
import Testing

/// What the city's edges are resolved from (#1400).
///
/// `sampleCount(on:)` is the only part of the renderer a test can reach: `init` also wants a
/// command queue and a compiled shader library, and a test process has neither.
///
/// Enabled only where there is a Metal device to ask. `#require` on a missing one would FAIL the
/// suite rather than skip it, and a box with no GPU has no fact here to be wrong about — it is the
/// same answer `AtlasVolumeRenderer.init` gives, which is a `nil` and a floor with nothing on it.
@Suite(
    "Atlas sampling — the city's edges are resolved, not stepped",
    .enabled(if: MTLCreateSystemDefaultDevice() != nil),
)
struct AtlasSamplingTests {
    /// Four is what every Metal device on this platform supports, so the fallback to one sample
    /// guards against a device that does not exist here rather than a path the app takes. The day
    /// this fails is the day the city is drawn at one sample and its edges are stepped again.
    @Test func `this device resolves the city at the count the renderer prefers`() throws {
        let device = try #require(MTLCreateSystemDefaultDevice())

        #expect(
            AtlasVolumeRenderer.sampleCount(on: device)
                == AtlasVolumeRenderer.preferredSampleCount,
        )
    }
}
