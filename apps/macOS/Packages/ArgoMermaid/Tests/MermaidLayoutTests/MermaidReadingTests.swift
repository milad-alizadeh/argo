@testable import MermaidLayout
import Testing

/// What a `mermaid` fence is read as, and — the half that matters more — what it is NOT read as.
/// Anything this reader cannot draw returns nothing, which is what leaves the block the fence it is
/// today: an unsupported diagram degrades DOWN to its source, never to an error or an empty box.
@Suite("Mermaid reading")
struct MermaidReadingTests {
    private static func read(_ source: String) -> MermaidFlowchart? {
        MermaidFlowchart.read(source)
    }

    @Test
    func `a graph header and its arrows are a flowchart`() {
        let chart = Self.read("graph TD\n  A --> B\n  B --> C")

        #expect(chart?.names == ["A", "B", "C"])
        #expect(chart?.edges == [.init(from: "A", to: "B"), .init(from: "B", to: "C")])
        #expect(chart?.direction == .down)
    }

    /// `flowchart` is the same diagram under mermaid's newer keyword, and a header with no
    /// direction runs the way mermaid's own default runs.
    @Test(arguments: [
        ("graph TD", MermaidDirection.down),
        ("flowchart TB", .down),
        ("graph BT", .up),
        ("flowchart LR", .right),
        ("graph RL", .left),
        ("graph", .down),
    ])
    func `each header names the direction it runs`(
        header: String,
        direction: MermaidDirection,
    ) {
        #expect(Self.read("\(header)\nA --> B")?.direction == direction)
    }

    /// The order is the order the source named them, so a diagram read twice lays out twice the
    /// same.
    @Test
    func `nodes keep the order the source first named them`() {
        #expect(Self.read("graph TD\nC --> A\nC --> B")?.names == ["C", "A", "B"])
    }

    @Test(arguments: [
        ("A[Rect]", MermaidFlowchart.Shape.rect),
        ("A(Rounded)", .rounded),
        ("A([Stadium])", .stadium),
        ("A[[Subroutine]]", .subroutine),
        ("A{Decision}", .diamond),
        ("A{{Hexagon}}", .hexagon),
        ("A((Circle))", .circle),
        ("A>Flag]", .flag),
        ("A[(Store)]", .cylinder),
    ])
    func `each bracket names the figure the node is drawn as`(
        spelling: String,
        shape: MermaidFlowchart.Shape,
    ) {
        let node = Self.read("graph TD\n\(spelling) --> B")?.nodes.first

        #expect(node?.shape == shape)
        #expect(node?.name == "A")
        #expect(node?.label.isEmpty == false)
        #expect(node?.label != "A")
    }

    /// A bare name is a rect labelled with itself, which is what mermaid draws it as.
    @Test
    func `a bare name is a rect labelled with itself`() {
        #expect(Self.read("graph TD\nA --> B")?.nodes.first
            == MermaidFlowchart.Node(name: "A", label: "A", shape: .rect))
    }

    @Test(arguments: [
        ("A --> B", MermaidFlowchart.Stroke.solid, true),
        ("A --- B", .solid, false),
        ("A -.-> B", .dotted, true),
        ("A -.- B", .dotted, false),
        ("A ==> B", .thick, true),
        ("A === B", .thick, false),
        ("A ----> B", .solid, true),
    ])
    func `each link kind is read as itself`(
        spelling: String,
        stroke: MermaidFlowchart.Stroke,
        hasHead: Bool,
    ) {
        let edge = Self.read("graph TD\n\(spelling)")?.edges.first

        #expect(edge?.stroke == stroke)
        #expect(edge?.hasHead == hasHead)
        #expect(edge?.label == nil)
    }

    /// Mermaid spells a word on a link two ways and means the same thing by both, so both land as
    /// one value and nothing downstream has to know which was written.
    @Test(arguments: [
        "A -->|yes| B",
        "A -- yes --> B",
        "A -.yes.-> B",
        "A == yes ==> B",
        "A -->|\"yes\"| B",
    ])
    func `a link carries its word in either spelling`(spelling: String) {
        #expect(Self.read("graph TD\n\(spelling)")?.edges.first?.label == "yes")
    }
}
