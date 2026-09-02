import Foundation
@testable import MermaidLayout
import Testing

/// Where a read diagram is placed. The claims are the ones a reader would make with their eyes on
/// it: no two boxes on top of each other, every label inside the box it names, and the same
/// diagram in the same place every time it is laid out.
@MainActor
@Suite("Mermaid layout")
struct MermaidLayoutTests {
    static func plan(_ source: String) -> MermaidPlan {
        MermaidDiagram.read(source)?.laid ?? .empty
    }

    /// Every box the plan drew, in the order it drew them.
    static func boxes(of plan: MermaidPlan) -> [CGRect] {
        plan.figures.compactMap { figure in
            guard case let .shape(outline, rect) = figure.form, outline != .enclosure else {
                return nil
            }
            return rect
        }
    }

    /// Three ranks and a fork, so the suite has both a stack and a row in it.
    private static let source = "graph TD\nA --> B\nA --> C\nB --> D\nC --> D"

    @Test
    func `no two nodes overlap`() {
        let boxes = Self.boxes(of: Self.plan(Self.source))

        #expect(boxes.count == 4)
        for (at, box) in boxes.enumerated() {
            for other in boxes[(at + 1)...] {
                #expect(!box.intersects(other))
            }
        }
    }

    /// The same source lays out the same twice. A dictionary of nodes iterated in its own order is
    /// how a diagram would come out different on every launch.
    @Test
    func `the same diagram lays out the same way twice`() {
        #expect(Self.plan(Self.source) == Self.plan(Self.source))
    }

    /// A rank is drawn in the order the source named its nodes, left to right. The nodes are placed
    /// out of a dictionary, and a dictionary's own order is seeded afresh on every launch — so the
    /// claim has to be about the SOURCE's order rather than about two calls agreeing.
    @Test
    func `a rank is placed in the order the source named its nodes`() {
        let plan = Self.plan("graph TD\nA --> First\nA --> Second\nA --> Third")
        let rank = plan.captions.filter { $0.rect.minY > 0 }

        #expect(rank.map(\.label.text) == ["First", "Second", "Third"])
        #expect(rank.map(\.rect.minX) == rank.map(\.rect.minX).sorted())
    }

    /// The pairing the view rests on: it builds one `Text` per label and places it on the caption
    /// at the same index.
    @Test
    func `captions carry the diagram's labels, in order`() {
        let diagram = MermaidDiagram.read(Self.source)

        #expect(Self.plan(Self.source).captions.map(\.label) == diagram?.labels)
    }

    @Test
    func `every node's caption is measured into the box it names`() {
        let plan = Self.plan(Self.source)
        let boxes = Self.boxes(of: plan)

        #expect(plan.captions.prefix(boxes.count).map(\.rect) == boxes)
    }

    /// A longest-path ranking, not a first-arrival one: `D` is drawn under BOTH branches that
    /// reach it rather than beside the one that reached it second.
    @Test
    func `a node is ranked under everything that reaches it`() {
        let boxes = Self.boxes(of: Self.plan(Self.source))

        guard boxes.count == 4 else { return #expect(Bool(false), "every node was placed") }
        #expect(boxes[1].midY == boxes[2].midY)
        #expect(boxes[3].minY > boxes[1].maxY)
    }

    /// An edge leaves the foot of the box above and ends in a head on the top of the box below, so
    /// the arrow lands ON the node rather than inside it — and the line stops short of its own
    /// head.
    @Test
    func `an edge is drawn as a connector and its head`() {
        let plan = Self.plan("graph TD\nA --> B")
        let boxes = Self.boxes(of: plan)

        guard boxes.count == 2 else { return #expect(Bool(false), "both nodes were placed") }
        let tip = CGPoint(x: boxes[1].midX, y: boxes[1].minY)
        let stem = CGPoint(x: tip.x, y: tip.y - MermaidMeasure.arrowLength)
        #expect(plan.figures.filter { $0.role == .edge } == [
            MermaidFigure(
                form: .path([CGPoint(x: boxes[0].midX, y: boxes[0].maxY), stem]), role: .edge,
            ),
            MermaidFigure(form: .arrowhead(tip: tip, from: stem), role: .edge),
        ])
    }

    /// An open link has no head at all, and the two loud links differ in the pen they are drawn
    /// with rather than in the ink — a diagram is one ink.
    @Test(arguments: [
        ("A --- B", MermaidFigure.Line.solid, 0),
        ("A -.-> B", .dotted, 1),
        ("A ==> B", .thick, 1),
    ])
    func `a link is drawn the way it was written`(
        source: String,
        line: MermaidFigure.Line,
        heads: Int,
    ) {
        let figures = Self.plan("graph TD\n\(source)").figures.filter { $0.role == .edge }

        #expect(figures.allSatisfy { $0.line == line })
        #expect(figures.count {
            if case .arrowhead = $0.form {
                true
            } else {
                false
            }
        } == heads)
    }

    /// A word on an edge sits BESIDE the line, because a connector runs under it otherwise and a
    /// word with a line through it is worse than one standing next to it.
    @Test
    func `an edge's word stands clear of the line it belongs to`() {
        let plan = Self.plan("graph TD\nA -->|yes| B")

        guard let word = plan.captions.first(where: { $0.label.text == "yes" }) else {
            return #expect(Bool(false), "the word was placed")
        }
        // Every connector here runs square, so a segment IS its own bounding box — which makes the
        // claim exact rather than a sample of points along it.
        let runs = plan.figures.compactMap { figure -> [CGPoint]? in
            guard case let .path(points) = figure.form else { return nil }
            return points
        }.flatMap { points in
            zip(points, points.dropFirst()).map { CGRect(around: $0, and: $1) }
        }

        #expect(!runs.isEmpty)
        #expect(!runs.contains { $0.intersects(word.rect) })
        #expect(word.rect.width > 0)
    }

    /// Each shape gets its OWN outline. A reader tells a decision from a step by the figure before
    /// reading either of them, so two shapes drawing the same outline is the bug.
    @Test
    func `every documented node shape draws as its own figure`() {
        let source = """
        graph TD
        A[Rect] --> B(Round)
        B --> C([Stad])
        C --> D[[Sub]]
        D --> E{Dec}
        E --> F{{Hex}}
        F --> G((Circ))
        G --> H>Flag]
        H --> I[(Store)]
        """
        let outlines = Self.plan(source).figures.compactMap { figure -> MermaidOutline? in
            guard case let .shape(outline, _) = figure.form else { return nil }
            return outline
        }

        #expect(outlines.count == 9)
        #expect(Set(outlines).count == 9)
    }

    /// A circle is drawn in a square box, because a label inscribed in one only fits the box it was
    /// measured into if that box is as tall as it is wide.
    @Test
    func `a circle is measured into a square`() {
        let box = Self.boxes(of: Self.plan("graph TD\nA((Circle)) --> B")).first

        #expect(box?.width == box?.height)
    }
}

extension CGRect {
    /// The box two points span. Every connector here runs square, so a segment IS its own box —
    /// which lets a caption's clearance be asserted exactly rather than sampled along the line.
    init(around one: CGPoint, and other: CGPoint) {
        self.init(
            x: Swift.min(one.x, other.x),
            y: Swift.min(one.y, other.y),
            width: abs(one.x - other.x),
            height: abs(one.y - other.y),
        )
    }
}
