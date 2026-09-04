import ArgoDesign
import AtlasLayout
import Testing

/// The second thing about this package that fails silently.
///
/// `AtlasBand`'s cuts and `ArgoPalette.MeasureRoles`' are two declarations of one decision, and
/// nothing holds them together: `AtlasLayout` depends on no contract, because the layout half
/// decides sizes and bands while the pigment a band resolves to is spent on a pixel. Let them
/// drift and a file is banded `.hot` by the layout and painted amber by the ramp — a legend that
/// disagrees with the map, and a picture that stays plausible.
///
/// This is the drawing half, which reads both, so it is where the two are checked. The layout's
/// own suite cannot make this claim: `AtlasLayoutTests` cannot see `ArgoDesign` at all.
@Suite("Atlas — the bands and the contract")
struct AtlasBandContractTests {
    @Test func `the layout cuts the measure where the contract does`() {
        #expect(AtlasBand.middlingFrom == ArgoPalette.MeasureRoles.middlingFrom)
        #expect(AtlasBand.hotFrom == ArgoPalette.MeasureRoles.hotFrom)
    }

    /// And the two arrive at the same band from the same fraction, including ON each cut, where
    /// the ramp's own rule is that the point belongs to the quieter band.
    @Test(arguments: [0.0, 0.49, 0.5, 0.51, 0.84, 0.85, 0.86, 1.0])
    func `a fraction bands the way the ramp paints it`(fraction: Double) {
        let measure = ArgoPalette.graphite.atlas.measure
        let painted: [ArgoColor: AtlasBand] = [
            measure.quiet: .quiet, measure.middling: .middling, measure.hot: .hot,
        ]

        #expect(painted[measure.ramp.color(at: fraction)] == AtlasBand(at: fraction))
    }
}
