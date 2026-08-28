@testable import ArgoUI
import Foundation
import Testing

/// A diagram in the lane, drawn as its own silhouette rather than as one featureless slab — off the
/// very plan `MermaidView` draws.
///
/// One layout for both, which is the point of the suite: a lane that laid the diagram out a second
/// way would be a second diagram, and nothing downstream could tell that from a bug.
@MainActor
@Suite("Minimap diagram silhouette")
struct MinimapMermaidTests {
    private static let measure: CGFloat = 720 - ArgoFeedRow.inset * 2
    private static let source = "graph TD\nA --> B\nA --> C"

    private static var diagram: MermaidDiagram? {
        MermaidDiagram.read(source)
    }

    @Test
    func `every node is a frame and every connector a line, in the diagram's own ink`() {
        let rects = Self.diagram?.mapped(across: Self.measure).rects ?? []

        #expect(rects.filter { $0.drawn == .frame }.count == 3)
        #expect(rects.filter { $0.drawn == .bar }.count == 4)
        #expect(rects.allSatisfy { $0.ink == .diagram })
    }

    /// The height the lane reports IS the height the plan stands at. The two cannot part company,
    /// because there is only one of them.
    @Test
    func `the reported height is the plan's own`() {
        let plan = Self.diagram?.laid

        #expect(Self.diagram?.mapped(across: Self.measure).height == plan?.size.height)
        #expect((plan?.size.height ?? 0) > 0)
    }

    /// Every mark stands inside the block it was reported for, so the lane draws the diagram where
    /// the feed draws it rather than over the block under it.
    @Test
    func `every mark stands inside the block's own height`() {
        let laid = Self.diagram?.mapped(across: Self.measure)

        #expect(laid?.rects.allSatisfy { $0.y + $0.height <= (laid?.height ?? 0) } == true)
    }

    /// A diagram too wide for the column is scrolled, so what the lane draws is what a reader who
    /// has not scrolled can see: the marks past the edge are clipped, not squeezed in.
    @Test
    func `a diagram wider than the column is clipped to it, not shrunk into it`() {
        let wide = MermaidDiagram.read("""
        graph LR
        A --> AnotherRatherLongNodeName
        AnotherRatherLongNodeName --> AThirdRatherLongNodeName
        AThirdRatherLongNodeName --> AFourthRatherLongNodeName
        """)
        let narrow: CGFloat = 120
        let laid = wide?.mapped(across: narrow)

        #expect((wide?.laid.size.width ?? 0) > narrow)
        #expect(laid?.rects.isEmpty == false)
        #expect(laid?.rects.allSatisfy { $0.to <= narrow } == true)
    }

    /// The claim #859's spine rests on, tested by a second diagram type: a sequence diagram is
    /// mapped and measured by this very lane, which learned nothing about it (#862).
    @Test
    func `a sequence diagram maps through the same lane`() {
        let diagram = MermaidDiagram.read("sequenceDiagram\nA->>B: go\nB-->>A: back")
        let laid = diagram?.mapped(across: Self.measure)

        #expect(laid?.height == diagram?.laid.size.height)
        #expect(laid?.rects.isEmpty == false)
        #expect(laid?.rects.allSatisfy { $0.ink == .diagram } == true)
    }

    /// The block comes off the row's markdown carrying the diagram itself, so the lane lays it out
    /// through the feed's own cached plan rather than through a reduction of it.
    @Test
    func `a diagram read from markdown carries the diagram itself`() {
        let text = "```mermaid\n\(Self.source)\n```"
        let blocks = MinimapProseBlock.blocks(from: MarkdownBlock.blocks(in: text))
        let chart = MermaidFlowchart(
            direction: .down,
            nodes: [
                .init(name: "A", label: "A"),
                .init(name: "B", label: "B"),
                .init(name: "C", label: "C"),
            ],
            edges: [.init(from: "A", to: "B"), .init(from: "A", to: "C")],
            groups: [],
        )
        let expected: [MinimapProseBlock] = [
            .diagram(MermaidDiagram(source: Self.source, kind: .flowchart(chart))),
        ]

        #expect(blocks == expected)
    }
}
