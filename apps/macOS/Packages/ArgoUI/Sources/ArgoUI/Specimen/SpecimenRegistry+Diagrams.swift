import SwiftUI

/// The `mermaid` fences, drawn. One subject of its own rather than more feed rows, because a
/// diagram type is added by a reader and a layout (#859) and each one arrives with its own
/// specimens — the list grows per type, and the feed's own states do not.
extension SpecimenRegistry {
    static let diagrams: [SpecimenEntry] = [
        // A diagram beside a fence declaring the same grammar that nothing here can read. The pair
        // is the claim: what Argo reads is drawn, and what it cannot degrades to the source it
        // shows today — never to an error and never to an empty box (#860).
        SpecimenEntry("feedMermaid") { MarkdownSpecimen(text: MarkdownSpecimen.diagrams) },
        // The three shapes of graph a layered layout has to get right, one specimen each (#861).
        SpecimenEntry("feedMermaidFlowchart") { MarkdownSpecimen(text: MermaidSpecimen.flowchart) },
        SpecimenEntry("feedMermaidSubgraph") { MarkdownSpecimen(text: MermaidSpecimen.subgraphs) },
        SpecimenEntry("feedMermaidCycle") { MarkdownSpecimen(text: MermaidSpecimen.cycle) },
        // The three shapes of exchange a sequence layout has to get right (#862): a plain one, one
        // carrying activations and notes, and one whose blocks nest.
        SpecimenEntry("feedMermaidSequence") { MarkdownSpecimen(text: MermaidSpecimen.sequence) },
        SpecimenEntry("feedMermaidSequenceRuns") {
            MarkdownSpecimen(text: MermaidSpecimen.sequenceRuns)
        },
        SpecimenEntry("feedMermaidSequenceBlocks") {
            MarkdownSpecimen(text: MermaidSpecimen.sequenceBlocks)
        },
        // The two things a mindmap layout has to get right (#867): branches that go ROUND the root
        // at three levels and more, and six node figures no two of which may draw alike.
        SpecimenEntry("feedMermaidMindmap") { MarkdownSpecimen(text: MermaidSpecimen.mindmap) },
        SpecimenEntry("feedMermaidMindmapShapes") {
            MarkdownSpecimen(text: MermaidSpecimen.mindmapShapes)
        },
        // The series palette drawn as the thing it is for (#864): eight wedges touching, and a
        // legend whose swatches have to be read back to them.
        SpecimenEntry("feedMermaidPie") { MarkdownSpecimen(text: MermaidSpecimen.pie) },
        SpecimenEntry("feedMermaidPieSingle") { MarkdownSpecimen(text: MermaidSpecimen.pieSingle) },
        // The three shapes of machine a state diagram has to get right (#863): a flat one, one
        // whose composite encloses its own states, and one that branches at a choice.
        SpecimenEntry("feedMermaidState") { MarkdownSpecimen(text: MermaidSpecimen.state) },
        SpecimenEntry("feedMermaidStateComposite") {
            MarkdownSpecimen(text: MermaidSpecimen.stateComposite)
        },
        SpecimenEntry("feedMermaidStateChoice") {
            MarkdownSpecimen(text: MermaidSpecimen.stateChoice)
        },
        // A quadrant chart fully labelled with its points clustered, and one plotting the edges of
        // the scale — the two states the flip and the nudging are actually looked at in (#868).
        SpecimenEntry("feedMermaidQuadrant") {
            MarkdownSpecimen(text: MermaidSpecimen.quadrant)
        },
        SpecimenEntry("feedMermaidQuadrantEdges") {
            MarkdownSpecimen(text: MermaidSpecimen.quadrantEdges)
        },
        // The three states one banded layout has to get right (#866): a journey's ratings and its
        // actor chips, a timeline whose periods carry uneven stacks, and a timeline naming no band.
        SpecimenEntry("feedMermaidJourney") { MarkdownSpecimen(text: MermaidSpecimen.journey) },
        SpecimenEntry("feedMermaidTimeline") { MarkdownSpecimen(text: MermaidSpecimen.timeline) },
        SpecimenEntry("feedMermaidTimelinePlain") {
            MarkdownSpecimen(text: MermaidSpecimen.timelinePlain)
        },
    ]
}
