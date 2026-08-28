@testable import ArgoUI
import Testing

/// Every diagram specimen really draws a diagram.
///
/// The gap this closes is a silent one. A specimen whose source stopped reading — a spelling this
/// reader never handled, a rule tightened under it — degrades to the fence it is meant to prove is
/// no longer needed, and every other test in the suite still passes. The render would say so, and
/// nothing else would.
@MainActor
@Suite("Mermaid specimens")
struct MermaidSpecimenTests {
    @Test(arguments: [
        MermaidSpecimen.flowchart,
        MermaidSpecimen.subgraphs,
        MermaidSpecimen.cycle,
        MermaidSpecimen.sequence,
        MermaidSpecimen.sequenceRuns,
        MermaidSpecimen.sequenceBlocks,
        MermaidSpecimen.mindmap,
        MermaidSpecimen.mindmapShapes,
        MermaidSpecimen.pie,
        MermaidSpecimen.pieSingle,
        MermaidSpecimen.state,
        MermaidSpecimen.stateComposite,
        MermaidSpecimen.stateChoice,
        MermaidSpecimen.quadrant,
        MermaidSpecimen.quadrantEdges,
        MermaidSpecimen.journey,
        MermaidSpecimen.timeline,
        MermaidSpecimen.timelinePlain,
        MermaidSpecimen.classes,
        MermaidSpecimen.classMembers,
        MermaidSpecimen.entities,
    ])
    func `a specimen's fence reads as a diagram and lays out`(specimen: String) {
        let drawn = MarkdownBlock.blocks(in: specimen).compactMap { block -> MermaidDiagram? in
            guard case let .diagram(diagram) = block else { return nil }
            return diagram
        }

        #expect(drawn.count == 1)
        #expect(drawn.first.map { $0.laid.size.width > 0 && $0.laid.size.height > 0 } == true)
        // One caption per label is the pairing `MermaidLayout` places its subviews by, and a
        // specimen is the one place every reader and every layout meet a real source.
        #expect(drawn.first.map { $0.laid.captions.count == $0.labels.count } == true)
    }
}
