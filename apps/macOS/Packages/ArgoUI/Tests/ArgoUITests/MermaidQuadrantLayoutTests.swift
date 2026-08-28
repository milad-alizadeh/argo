@testable import ArgoUI
import Foundation
import Testing

/// Where a read quadrant chart is placed. The claims are the ones a reader would make with their
/// eyes on it: a field with a cross through it, four corners labelled in mermaid's own numbering,
/// and every point where its coordinates say — with the y axis running the other way up from the
/// coordinates it is drawn in.
@MainActor
@Suite("Mermaid quadrant layout")
struct MermaidQuadrantLayoutTests {
    static func plan(_ body: String) -> MermaidPlan {
        MermaidQuadrant.read("quadrantChart\n" + body)?.laid ?? .empty
    }

    /// The field itself: the one rectangle a quadrant chart draws.
    static func field(of plan: MermaidPlan) -> CGRect {
        shapes(of: plan, .rect).first ?? .zero
    }

    static func dots(of plan: MermaidPlan) -> [CGRect] {
        shapes(of: plan, .ellipse)
    }

    static func shapes(of plan: MermaidPlan, _ outline: MermaidOutline) -> [CGRect] {
        plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(drawn, rect) = figure.form, drawn == outline else { return nil }
            return rect
        }
    }

    static func paths(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap { figure -> [CGPoint]? in
            guard case let .path(points) = figure.form else { return nil }
            return points
        }
    }

    private static let labelled = """
    title Reach and engagement
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 Expand
    quadrant-2 Promote
    quadrant-3 Re-evaluate
    quadrant-4 Improve
    """

    @Test
    func `the field is crossed by two rules through its centre, all in the axis role`() {
        let plan = Self.plan(Self.labelled)
        let field = Self.field(of: plan)
        let rules = Self.paths(of: plan)

        #expect(field.width > 0)
        #expect(rules.count == 2)
        #expect(rules.contains([
            CGPoint(x: field.midX, y: field.minY), CGPoint(x: field.midX, y: field.maxY),
        ]))
        #expect(rules.contains([
            CGPoint(x: field.minX, y: field.midY), CGPoint(x: field.maxX, y: field.midY),
        ]))
        #expect(plan.figures.filter { $0.role == .axis }.count == 3)
    }

    /// The whole of the flip: `0.9` is near the TOP, which is a SMALLER y in the coordinates the
    /// plan is drawn in.
    @Test
    func `the y axis runs the other way up from the coordinates it is drawn in`() {
        let plan = Self.plan("Low: [0.5, 0.1]\nHigh: [0.5, 0.9]")
        let dots = Self.dots(of: plan)

        #expect(dots.count == 2)
        #expect(dots[0].midY > dots[1].midY)
        #expect(dots[0].midX == dots[1].midX)
    }

    @Test
    func `x plots left to right`() {
        let dots = Self.dots(of: Self.plan("Left: [0.1, 0.5]\nRight: [0.9, 0.5]"))

        #expect(dots[0].midX < dots[1].midX)
    }

    /// A point at the very edge of the scale is still a mark inside the field rather than half of
    /// one hanging off it.
    @Test(arguments: ["[0, 0]", "[1, 1]", "[0, 1]", "[1, 0]", "[0.5, 0]"])
    func `a point at the edge of the scale draws inside the field`(at: String) {
        let plan = Self.plan("Edge: \(at)")
        let field = Self.field(of: plan)

        #expect(Self.dots(of: plan).count == 1)
        #expect(field.contains(Self.dots(of: plan)[0]))
    }

    /// Mermaid's numbering, drawn: 1 top right, 2 top left, 3 bottom left, 4 bottom right. Reading
    /// order here would mirror every chart.
    @Test
    func `the four corner labels stand in mermaid's own corners`() {
        let plan = Self.plan(Self.labelled)
        let field = Self.field(of: plan)
        let corners = plan.captions.filter {
            ["Expand", "Promote", "Re-evaluate", "Improve"].contains($0.label.text)
        }

        #expect(corners.map(\.label.text) == ["Expand", "Promote", "Re-evaluate", "Improve"])
        #expect(corners.map { $0.rect.midX > field.midX } == [true, false, false, true])
        #expect(corners.map { $0.rect.midY < field.midY } == [true, true, false, false])
    }

    /// Points clustered on top of each other still read: the names nudge off one another rather
    /// than being drawn one over the next.
    @Test
    func `the names of clustered points do not overlap`() {
        let plan = Self.plan("""
        Alpha: [0.5, 0.5]
        Beta: [0.51, 0.5]
        Gamma: [0.5, 0.51]
        Delta: [0.52, 0.52]
        """)
        let names = plan.captions.suffix(4).map(\.rect)

        for (at, name) in names.enumerated() {
            for other in names[(at + 1)...] {
                #expect(!name.intersects(other))
            }
        }
    }

    /// A name has to clear the words already on the field, not only the other points: a name over
    /// a corner label is the same failure as a name over its neighbour.
    @Test
    func `a point's name clears the words already standing on the field`() {
        let plan = Self.plan(Self.labelled + "\nHigh: [0.95, 0.95]\nLow: [0.04, 0.04]")
        let settled = plan.captions.dropLast(2).map(\.rect)

        for name in plan.captions.suffix(2).map(\.rect) {
            #expect(!settled.contains { $0.intersects(name) })
        }
    }

    /// A corner's words step aside for a point plotted under them. The point cannot move — it is
    /// the data — so the label is what gives way.
    @Test
    func `a corner label steps aside for a point plotted in its own corner`() {
        let plan = Self.plan(Self.labelled + "\nEdge: [0.98, 0.98]")
        let corner = plan.captions.first { $0.label.text == "Expand" }?.rect ?? .zero

        #expect(corner.width > 0)
        #expect(!Self.dots(of: plan).contains { $0.intersects(corner) })
    }

    /// The title is set in a bigger face than everything else on the chart, so the room above the
    /// field is its own line box rather than the quiet face's.
    @Test
    func `the title is given the room its own face takes`() {
        let title = Self.plan(Self.labelled).captions.first {
            $0.label.text == "Reach and engagement"
        }

        #expect(title?.rect.height ?? 0 >= ceil(ProseFace.header.lineBox))
    }

    @Test
    func `a chart with no points still draws its field and names its corners`() {
        let plan = Self.plan(Self.labelled)

        #expect(Self.dots(of: plan).isEmpty)
        #expect(Self.field(of: plan).width > 0)
        #expect(plan.captions.map(\.label.text).contains("Re-evaluate"))
    }

    /// The pairing the view rests on: it builds one `Text` per label and places it on the caption
    /// at the same index.
    @Test
    func `captions carry the chart's labels, in order`() {
        let chart = MermaidQuadrant.read("quadrantChart\n" + Self.labelled + "\nA: [0.2, 0.2]")

        #expect(chart?.laid.captions.map(\.label) == chart?.labels)
    }

    /// The flip again, in words this time: `y-axis Low --> High` names the foot Low.
    @Test
    func `the y axis names its low end at the foot and its high end at the head`() {
        let plan = Self.plan(Self.labelled)
        let low = plan.captions.first { $0.label.text == "Low Engagement" }
        let high = plan.captions.first { $0.label.text == "High Engagement" }
        let field = Self.field(of: plan)

        #expect(low?.rect.midY ?? 0 > field.midY)
        #expect(high?.rect.midY ?? 0 < field.midY)
        #expect(low?.rect.maxX ?? 0 <= field.minX)
    }

    @Test
    func `both ends of the x axis stand under the field, low end first`() {
        let plan = Self.plan(Self.labelled)
        let field = Self.field(of: plan)
        let low = plan.captions.first { $0.label.text == "Low Reach" }
        let high = plan.captions.first { $0.label.text == "High Reach" }

        #expect(low?.rect.minY ?? 0 >= field.maxY)
        #expect(low?.rect.midX ?? 0 < high?.rect.midX ?? 0)
    }

    @Test
    func `the title stands above the field`() {
        let plan = Self.plan(Self.labelled)
        let title = plan.captions.first { $0.label.text == "Reach and engagement" }

        #expect(title?.rect.maxY ?? .infinity <= Self.field(of: plan).minY)
    }

    @Test
    func `the same chart lays out the same way twice`() {
        #expect(Self.plan(Self.labelled) == Self.plan(Self.labelled))
    }
}
