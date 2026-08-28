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
    private static func plan(_ body: String) -> MermaidPlan {
        MermaidQuadrant.read("quadrantChart\n" + body)?.laid ?? .empty
    }

    /// The field itself: the one rectangle a quadrant chart draws.
    private static func field(of plan: MermaidPlan) -> CGRect {
        shapes(of: plan, .rect).first ?? .zero
    }

    private static func dots(of plan: MermaidPlan) -> [CGRect] {
        shapes(of: plan, .ellipse)
    }

    private static func shapes(of plan: MermaidPlan, _ outline: MermaidOutline) -> [CGRect] {
        plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(drawn, rect) = figure.form, drawn == outline else { return nil }
            return rect
        }
    }

    private static func paths(of plan: MermaidPlan) -> [[CGPoint]] {
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

    /// More points on one spot than there are places around a mark. Every name must still stand
    /// clear of every other and of every mark: a name that gave up on its own dot would be squeezed
    /// to 8 points wide and drawn over it.
    @Test
    func `a cluster deeper than the places around a mark still places every name`() {
        let names = (1 ... 16).map { "Point \($0)" }
        let plan = Self.plan(names.map { "\($0): [0.5, 0.5]" }.joined(separator: "\n"))
        let placed = plan.captions.suffix(16).map(\.rect)
        let marks = Self.dots(of: plan)

        #expect(placed.count == 16)
        #expect(placed.allSatisfy { $0.width > MermaidMeasure.pointRadius * 2 })
        #expect(!placed.contains { name in marks.contains { $0.intersects(name) } })
        for (at, name) in placed.enumerated() {
            for other in placed[(at + 1)...] {
                #expect(!name.intersects(other))
            }
        }
    }

    @Test
    func `a chart with no points still draws its field and names its corners`() {
        let plan = Self.plan(Self.labelled)

        #expect(Self.dots(of: plan).isEmpty)
        #expect(Self.field(of: plan).width > 0)
        #expect(plan.captions.map(\.label.text).contains("Re-evaluate"))
    }

    @Test
    func `the same chart lays out the same way twice`() {
        #expect(Self.plan(Self.labelled) == Self.plan(Self.labelled))
    }
}
