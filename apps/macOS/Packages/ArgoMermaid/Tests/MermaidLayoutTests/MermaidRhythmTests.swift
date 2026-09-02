import ArgoDesign
@testable import MermaidLayout
import Testing

/// Every gap a diagram is measured at is a step of the shared ladder.
///
/// Its own suite beside the renderer rather than a block of `ArgoUI`'s `RhythmTests`, because
/// `MermaidMeasure`'s steps are `package` — the claim has to be made inside the package that
/// declares them (#1087). The claim itself is the one that suite makes for every other surface: a
/// gap picked by hand is a gap that drifts from the rhythm around it.
@Suite("Mermaid rhythm")
struct MermaidRhythmTests {
    @Test
    func `every step the renderer names is a step the rhythm already carries`() {
        let ladder = Set(ArgoSpacing.all.map(\.value))
        #expect(ladder.isSuperset(of: [
            MermaidMeasure.nodeInsetX, MermaidMeasure.nodeInsetY, MermaidMeasure.rankGap,
            MermaidMeasure.nodeGap, MermaidMeasure.groupInset, MermaidMeasure.backLane,
            MermaidMeasure.wordGap,
        ]))
    }
}
