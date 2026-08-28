@testable import ArgoUI
import Foundation
import Testing

/// The words a quadrant chart sets, and the room they are given. Two claims: they stand where
/// mermaid's own numbering says, and the field is as wide as the widest of them asks — every word
/// takes a fixed share of the field, so a share too narrow wraps it inside a one-line box.
@MainActor
@Suite("Mermaid quadrant words")
struct MermaidQuadrantWordsTests {
    private static func plan(_ body: String) -> MermaidPlan {
        MermaidQuadrant.read("quadrantChart\n" + body)?.laid ?? .empty
    }

    /// The field itself: the one rectangle a quadrant chart draws.
    private static func field(of plan: MermaidPlan) -> CGRect {
        plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(.rect, rect) = figure.form else { return nil }
            return rect
        }.first ?? .zero
    }

    private static func dots(of plan: MermaidPlan) -> [CGRect] {
        plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(.ellipse, rect) = figure.form else { return nil }
            return rect
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

    /// A corner's words step aside for a point plotted under them. The point cannot move — it is
    /// the data — so the label is what gives way, OUT of the field. A label walking inward walks
    /// into the cluster its own quadrant is about, and then reads as a second name on that mark.
    @Test
    func `a corner label steps out of the field, never toward its middle`() {
        let plan = Self.plan(Self.labelled + "\nEdge: [0.98, 0.98]")
        let field = Self.field(of: plan)
        let settled = Self.plan(Self.labelled).captions.first { $0.label.text == "Expand" }?.rect
        let moved = plan.captions.first { $0.label.text == "Expand" }?.rect ?? .zero

        #expect(moved.width > 0)
        #expect(!Self.dots(of: plan).contains { $0.intersects(moved) })
        // Out of the top of the field, which is away from its middle — not down into it.
        #expect(moved.midY < settled?.midY ?? 0)
        #expect(moved.midY < field.minY)
    }

    /// A bottom corner steps the other way out, which is the same rule read the other way up.
    @Test
    func `a bottom corner steps down out of the field`() {
        let plan = Self.plan(Self.labelled + "\nEdge: [0.02, 0.02]")
        let field = Self.field(of: plan)
        let moved = plan.captions.first { $0.label.text == "Re-evaluate" }?.rect ?? .zero

        #expect(moved.midY > field.maxY)
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

    /// Every word the chart sets is given a fixed share of the field, so the field is as wide as
    /// its widest word asks — a share too narrow wraps the word inside a one-line box.
    @Test
    func `a title longer than the field widens the field rather than wrapping`() {
        let title = "A title far longer than any field this chart would otherwise be drawn at"
        let plan = Self.plan("title \(title)\nA: [0.5, 0.5]")
        let caption = plan.captions.first { $0.label.text == title }?.rect ?? .zero

        #expect(caption.width >= ceil(ProseMetrics.width(of: title, in: .header)))
        #expect(caption.height >= ceil(ProseFace.header.lineBox))
        #expect(plan.size.width >= caption.width)
    }

    @Test
    func `an axis end longer than half the field widens the field too`() {
        let end = "An extremely long name for the far end of this particular scale"
        let plan = Self.plan("x-axis Low --> \(end)")
        let caption = plan.captions.first { $0.label.text == end }?.rect ?? .zero

        #expect(caption.width >= MermaidQuadrantField.width(of: end))
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

    /// The pairing the view rests on: it builds one `Text` per label and places it on the caption
    /// at the same index.
    @Test
    func `captions carry the chart's labels, in order`() {
        let chart = MermaidQuadrant.read("quadrantChart\n" + Self.labelled + "\nA: [0.2, 0.2]")

        #expect(chart?.laid.captions.map(\.label) == chart?.labels)
    }
}
