import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import Metal
import Testing

/// The id target draws at the count the city is drawn at (#1153, under #1400).
///
/// This is the one thing about multisampling that fails SILENTLY and completely. A pass whose
/// attachments disagree with its pipeline about the sample count does not draw — no encoder, no
/// picture, no ids — and every other test here runs the sweep at one sample, where an attachment
/// built at the wrong count is still the right count by accident.
///
/// So this renders through the app's own path at the DEVICE's own count, which is what ships, and
/// asks the map a question only a frame that actually drew can answer.
@Suite(
    "Atlas — the ids are drawn at the count the city is",
    .enabled(if: AtlasPickHarness.isAvailable),
)
@MainActor
struct AtlasIdSamplingTests {
    /// Rendered multisampled, the map still names its files.
    ///
    /// The assertion is deliberately not per pixel: multisampled, an edge pixel is a blend of two
    /// boxes and the picture has no single file at it to be equal to. What is asked instead is what
    /// a broken sample count destroys outright — that the frame drew at all, and that the ids in it
    /// name real files of the map rather than the undefined bytes of a target nothing wrote.
    @Test func `the multisampled map still answers with the files it drew`() async throws {
        let samples = try #require(
            MTLCreateSystemDefaultDevice().map(AtlasVolumeRenderer.sampleCount(on:)),
        )
        let harness = try #require(
            AtlasPickHarness(samples: samples),
            AtlasPickingTests.unrenderable,
        )
        let plan = AtlasPickingTests.plan()
        let city = AtlasVolumes.city(of: plan, in: AtlasPickingTests.pigments)
        let paths = Set(plan.tiles.map(\.path))

        _ = try #require(await harness.frame(
            of: city,
            plan: plan,
            through: AtlasCamera.city(over: plan.extent),
        ))

        var named = 0
        for y in stride(from: 0, to: AtlasPickHarness.size.height, by: AtlasPickingTests.step) {
            for x in stride(from: 0, to: AtlasPickHarness.size.width, by: AtlasPickingTests.step) {
                let pick = try #require(harness.pick(at: AtlasPixel(x: x, y: y)))
                guard let file = pick.file else { continue }
                #expect(paths.contains(file), "picked \(file), which this map has no such file in")
                named += 1
            }
        }
        // The city fills most of the frame, so a sweep of it that named nothing is a frame that
        // never drew — which is precisely what a mismatched sample count leaves behind.
        #expect(named > 0)
    }
}
