@testable import ArgoUI
import Testing

/// The structure a flowchart's source states beyond one link at a time: chains, groups on one side
/// of a link, `subgraph` blocks — and every shape of source this reader refuses.
///
/// The refusals are the half that matters. A source not fully understood returns nothing, which is
/// what leaves the block the fence it is today rather than an error or an empty box.
@Suite("Mermaid structure reading")
struct MermaidStructureReadingTests {
    private static func read(_ source: String) -> MermaidFlowchart? {
        MermaidFlowchart.read(source)
    }

    @Test
    func `a chain states an edge per neighbouring pair`() {
        let chart = Self.read("graph TD\nA --> B --> C")

        #expect(chart?.names == ["A", "B", "C"])
        #expect(chart?.edges == [.init(from: "A", to: "B"), .init(from: "B", to: "C")])
    }

    /// `&` is a group on one side of a link, so every member of one side reaches every member of
    /// the other.
    @Test
    func `an ampersand joins every node of one side to every node of the other`() {
        #expect(Self.read("graph TD\nA & B --> C & D")?.edges == [
            .init(from: "A", to: "C"), .init(from: "A", to: "D"),
            .init(from: "B", to: "C"), .init(from: "B", to: "D"),
        ])
    }

    @Test
    func `a subgraph encloses exactly the nodes inside it`() {
        let chart = Self.read("graph TD\nsubgraph Reading\nA --> B\nend\nB --> C")

        #expect(chart?.groups == [.init(title: "Reading", members: ["A", "B"])])
        #expect(chart?.names == ["A", "B", "C"])
    }

    /// A nested block's members are its parent's too, so the outer enclosure really does contain
    /// the inner one rather than cutting through it.
    @Test
    func `a nested subgraph is enclosed by the one around it`() {
        let chart = Self.read("""
        graph TD
        subgraph Outer
        subgraph Inner
        A --> B
        end
        B --> C
        end
        """)

        #expect(chart?.groups == [
            .init(title: "Outer", members: ["A", "B", "C"]),
            .init(title: "Inner", members: ["A", "B"]),
        ])
    }

    @Test(arguments: [
        "subgraph Reading",
        "subgraph read [Reading]",
        "subgraph read[Reading]",
    ])
    func `a subgraph takes its title however it was opened`(opening: String) {
        #expect(Self.read("graph TD\n\(opening)\nA --> B\nend")?.groups.first?.title == "Reading")
    }

    /// A quoted label is taken verbatim, which is the only way a label carrying a bracket or a pipe
    /// can be written at all.
    @Test
    func `a quoted label carries what would otherwise read as syntax`() {
        #expect(Self.read("graph TD\nA[\"a [b] | c\"] --> B")?.nodes.first?.label == "a [b] | c")
    }

    /// A node named twice is spelled once: the mention that said something wins, and a later bare
    /// mention does not reset the box to its own name.
    @Test
    func `a bare mention does not undo the label a node was given`() {
        let chart = Self.read("graph TD\nA[Start] --> B\nA --> C")

        #expect(chart?.nodes.first?.label == "Start")
        #expect(chart?.names == ["A", "B", "C"])
    }

    @Test(arguments: [
        "graph TD\n%% a note to nobody\nA --> B",
        "graph TD\nA --> B %% said about the line above",
        "graph TD\nA --> B;",
    ])
    func `punctuation the diagram does not speak in says nothing`(source: String) {
        #expect(Self.read(source)?.edges.count == 1)
    }

    /// Only OUTSIDE a quoted label, which exists precisely so a label can carry what would
    /// otherwise read as syntax.
    @Test
    func `a comment mark inside a quoted label is part of the label`() {
        #expect(Self.read("graph TD\nA[\"100%% done\"] --> B")?.nodes.first?.label == "100%% done")
    }

    /// `subgraph` is a keyword, not a prefix. A node whose name merely starts with those letters
    /// would otherwise open a block nothing ever closes, and refuse the whole diagram.
    @Test
    func `a node whose name starts with the keyword is still a node`() {
        #expect(Self.read("graph TD\nsubgraphFoo --> B")?.names == ["subgraphFoo", "B"])
    }

    @Test
    func `a node standing alone is still a node`() {
        #expect(Self.read("graph TD\nA[Start]")?.nodes
            == [.init(name: "A", label: "Start", shape: .rect)])
    }

    @Test(arguments: [
        "",
        "graph TD",
        "pie title Where the time went\n\"Reading\" : 40",
        "graph TD\nA ~~~ B",
        "graph TD\nA <--> B",
        "graph TD\nA --> B\nsubgraph one",
        "graph TD\nA --> B\nend",
        "graph TD\nA[Start --> B",
        "graph TD\nA --> ",
        "graph TD\nclassDef loud fill:#f00",
        "graph SIDEWAYS\nA --> B",
        "  A --> B",
    ])
    func `a source this reader cannot draw is read as nothing`(source: String) {
        #expect(Self.read(source) == nil)
    }

    /// A diagram is a whole or it is a fence. Reading the lines that happen to parse would draw a
    /// diagram nobody wrote.
    @Test
    func `one unreadable line refuses the whole source`() {
        #expect(Self.read("graph TD\nA --> B\nB ~~~ C") == nil)
    }

    @Test
    func `a diagram carries the source its plan is cached on`() {
        let source = "graph TD\nA --> B"

        #expect(MermaidDiagram.read(source)?.source == source)
        #expect(MermaidDiagram.read("pie\n\"a\" : 1") == nil)
    }

    /// The labels the view builds its `Text` views from, before SwiftUI has told it a measure:
    /// every node, then every edge that carries a word, then every group's title.
    @Test
    func `a flowchart labels its nodes, then its edges, then its groups`() {
        let source = "graph TD\nsubgraph Reading\nA -->|first| B\nend\nB --> C"

        #expect(MermaidDiagram.read(source)?.labels.map(\.text) == [
            "A",
            "B",
            "C",
            "first",
            "Reading",
        ])
    }
}
