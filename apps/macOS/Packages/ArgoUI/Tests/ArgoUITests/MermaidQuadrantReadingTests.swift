@testable import ArgoUI
import Foundation
@testable import MermaidLayout
import Testing

/// What a `quadrantChart` fence is read as, and — the half that matters more — what it is NOT read
/// as. Anything this reader cannot draw returns nothing, which leaves the block the fence it is
/// today.
@Suite("Mermaid quadrant reading")
struct MermaidQuadrantReadingTests {
    private static func read(_ body: String) -> MermaidQuadrant? {
        MermaidQuadrant.read("quadrantChart\n" + body)
    }

    @Test
    func `a chart with a title, both axes, four corners and points reads whole`() {
        let chart = Self.read("""
        title Reach and engagement
        x-axis Low Reach --> High Reach
        y-axis Low Engagement --> High Engagement
        quadrant-1 Expand
        quadrant-2 Promote
        quadrant-3 Re-evaluate
        quadrant-4 Improve
        Campaign A: [0.3, 0.6]
        Campaign B: [0.45, 0.23]
        """)

        #expect(chart?.title == "Reach and engagement")
        #expect(chart?.xAxis == MermaidQuadrant.Axis(start: "Low Reach", end: "High Reach"))
        #expect(chart?.yAxis.end == "High Engagement")
        #expect(chart?.corners == ["Expand", "Promote", "Re-evaluate", "Improve"])
        #expect(chart?.points.map(\.name) == ["Campaign A", "Campaign B"])
        #expect(chart?.points.first?.at == CGPoint(x: 0.3, y: 0.6))
    }

    @Test(arguments: [
        "flowchart TD\nA --> B",
        "quadrantChart",
        "quadrantChart\nx-axis",
        "quadrantChart\nsomething nobody wrote",
        "quadrantChart\nA: [0.3]",
        "quadrantChart\nA: [0.3, 0.6, 0.9]",
        "quadrantChart\nA: [nought, 0.6]",
        "quadrantChart\nA: [1.4, 0.6]",
        "quadrantChart\nA: [0.3, -0.1]",
        "quadrantChart\nquadrant-5 Nowhere",
        "quadrantChart\nquadrant-1",
        "quadrantChart\n: [0.3, 0.6]",
    ])
    func `a source this reader cannot draw is no chart at all`(source: String) {
        #expect(MermaidQuadrant.read(source) == nil)
    }

    /// An axis written with one end only is one mermaid draws, and so is a chart with no points at
    /// all.
    @Test
    func `an axis names one end where only one was written`() {
        let chart = Self.read("x-axis Low Reach")

        #expect(chart?.xAxis == MermaidQuadrant.Axis(start: "Low Reach", end: ""))
        #expect(chart?.points.isEmpty == true)
    }

    /// The point of the numbering: `quadrant-1` is the top RIGHT, and the corners run anticlockwise
    /// from there. Reading order would put `quadrant-1` top left and mirror the whole chart.
    @Test
    func `mermaid numbers the corners anticlockwise from the top right`() {
        let corners = MermaidQuadrant.Corner.allCases

        #expect(corners.map(\.rawValue) == [1, 2, 3, 4])
        #expect(corners.map(\.isRight) == [true, false, false, true])
        #expect(corners.map(\.isTop) == [true, true, false, false])
    }

    @Test
    func `a comment and a trailing semicolon are taken off before anything is read`() {
        let chart = Self.read("%% a note\ntitle Reach; %% and another")

        #expect(chart?.title == "Reach")
    }

    /// The epic's own rule at the block seam: a chart this reader refuses stays the fence it is
    /// today, never an error and never an empty box.
    @Test
    func `a quadrant fence Argo cannot read stays a fence`() {
        let code = "quadrantChart\nCampaign A: [2, 0.6]"

        #expect(MarkdownBlock.blocks(in: "```mermaid\n\(code)\n```")
            == [.fenced(code: code, info: "mermaid")])
    }

    @Test
    func `a quadrant fence Argo can read is a diagram`() {
        let code = "quadrantChart\nCampaign A: [0.2, 0.6]"
        let chart = MermaidQuadrant.read(code)

        #expect(MarkdownBlock.blocks(in: "```mermaid\n\(code)\n```")
            == [.diagram(MermaidDiagram(
                source: code,
                kind: .quadrant(chart ?? MermaidQuadrant()),
            ))])
    }

    /// A half-streamed fence — the very shape a message arrives in — stays a fence rather than
    /// drawing half a chart.
    @Test
    func `a half written point line refuses the whole source`() {
        #expect(Self.read("title Reach\nCampaign A: [0.3,") == nil)
    }
}
