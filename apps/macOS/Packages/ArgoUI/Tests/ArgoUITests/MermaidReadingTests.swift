@testable import ArgoUI
import Testing

/// What a `mermaid` fence is read as, and — the half that matters more — what it is NOT read as.
/// Anything this reader cannot draw returns nothing, which is what leaves the block the fence it is
/// today: an unsupported diagram degrades DOWN to its source, never to an error or an empty box.
@Suite("Mermaid reading")
struct MermaidReadingTests {
    @Test
    func `a graph header and its arrows are a flowchart`() {
        #expect(MermaidFlowchart.read("graph TD\n  A --> B\n  B --> C") == MermaidFlowchart(
            nodes: ["A", "B", "C"],
            edges: [.init(from: "A", to: "B"), .init(from: "B", to: "C")],
        ))
    }

    /// `flowchart` is the same diagram under mermaid's newer keyword.
    @Test
    func `flowchart is the same header`() {
        #expect(MermaidFlowchart.read("flowchart TB\nA --> B")?.nodes == ["A", "B"])
    }

    /// The order is the order the source named them, so a diagram read twice lays out twice the
    /// same.
    @Test
    func `nodes keep the order the source first named them`() {
        #expect(MermaidFlowchart.read("graph TD\nC --> A\nC --> B")?.nodes == ["C", "A", "B"])
    }

    @Test(arguments: [
        "",
        "graph TD",
        "pie title Where the time went\n\"Reading\" : 40",
        "graph LR\nA --> B",
        "graph TD\nA[Start] --> B",
        "graph TD\nA -->|yes| B",
        "graph TD\nA --> B\nsubgraph one",
        "  A --> B",
    ])
    func `a source this reader cannot draw is read as nothing`(source: String) {
        #expect(MermaidFlowchart.read(source) == nil)
    }

    /// A diagram is a whole or it is a fence. Reading the lines that happen to parse would draw a
    /// diagram nobody wrote.
    @Test
    func `one unreadable line refuses the whole source`() {
        #expect(MermaidFlowchart.read("graph TD\nA --> B\nB -.-> C") == nil)
    }

    @Test
    func `a diagram carries the source its plan is cached on`() {
        let source = "graph TD\nA --> B"

        #expect(MermaidDiagram.read(source)?.source == source)
        #expect(MermaidDiagram.read("pie\n\"a\" : 1") == nil)
    }

    /// The labels the view builds its `Text` views from, before SwiftUI has told it a measure.
    @Test
    func `a flowchart labels every node it named`() {
        #expect(MermaidDiagram.read("graph TD\nA --> B")?.labels.map(\.text) == ["A", "B"])
    }
}
