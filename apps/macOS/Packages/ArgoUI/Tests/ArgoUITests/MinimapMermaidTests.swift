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
        let plan = Self.diagram?.laid(across: Self.measure)

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

    /// The block comes off the row's markdown carrying the diagram itself, so the lane lays it out
    /// through the feed's own cached plan rather than through a reduction of it.
    @Test
    func `a diagram read from markdown carries the diagram itself`() {
        let text = "```mermaid\n\(Self.source)\n```"

        #expect(MinimapProseBlock.blocks(from: MarkdownBlock.blocks(in: text))
            == [.diagram(MermaidDiagram(
                source: Self.source,
                kind: .flowchart(MermaidFlowchart(
                    nodes: ["A", "B", "C"],
                    edges: [.init(from: "A", to: "B"), .init(from: "A", to: "C")],
                )),
            ))])
    }
}
