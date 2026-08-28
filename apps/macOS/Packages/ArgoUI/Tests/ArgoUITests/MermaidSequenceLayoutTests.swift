@testable import ArgoUI
import Foundation
import Testing

/// Where a read sequence diagram is placed. The claims are the ones a reader would make with their
/// eyes on it: participants across the top in the order written, lifelines under them, and every
/// arrow between the two columns it names.
@MainActor
@Suite("Mermaid sequence layout")
struct MermaidSequenceLayoutTests {
    static func plan(_ body: String) -> MermaidPlan {
        MermaidSequence.read("sequenceDiagram\n" + body)?.laid ?? .empty
    }

    /// Every closed outline the plan drew, in the order it drew them.
    static func shapes(of plan: MermaidPlan, _ outline: MermaidOutline) -> [CGRect] {
        plan.figures.compactMap { figure in
            guard case let .shape(drawn, rect) = figure.form, drawn == outline else { return nil }
            return rect
        }
    }

    /// Every polyline the plan drew.
    static func paths(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap { figure in
            guard case let .path(points) = figure.form else { return nil }
            return points
        }
    }

    /// The lifelines: the only vertical runs that start at the head of the diagram.
    static func lifelines(of plan: MermaidPlan) -> [[CGPoint]] {
        paths(of: plan).filter { $0.count == 2 && $0[0].x == $0[1].x && $0[0].y < $0[1].y }
    }

    private static let source = "A->>B: one\nB-->>A: two"

    @Test
    func `participants stand across the top, in the order written`() {
        let boxes = Self.shapes(of: Self.plan("C->>A: one\nA->>B: two"), .rect)

        #expect(boxes.count == 3)
        #expect(boxes.map(\.minY) == [0, 0, 0])
        #expect(boxes.map(\.minX) == boxes.map(\.minX).sorted())
    }

    @Test
    func `a lifeline drops from each participant`() {
        let plan = Self.plan(Self.source)
        let boxes = Self.shapes(of: plan, .rect)
        let lines = Self.lifelines(of: plan)

        #expect(lines.count == 2)
        #expect(lines.map { $0[0].x } == boxes.map(\.midX))
        // From the foot of the boxes to the foot of the diagram.
        #expect(lines.allSatisfy { $0[0].y == boxes[0].maxY && $0[1].y <= plan.size.height })
    }

    @Test
    func `the same diagram lays out the same way twice`() {
        #expect(Self.plan(Self.source) == Self.plan(Self.source))
    }

    /// The pairing the view rests on: it builds one `Text` per label and places it on the caption
    /// at the same index.
    @Test
    func `captions carry the diagram's labels, in order`() {
        let diagram = MermaidSequence.read("sequenceDiagram\n" + Self.source)

        #expect(Self.plan(Self.source).captions.map(\.label) == diagram?.labels)
    }

    @Test
    func `each participant's caption is measured into the box at the head of its lifeline`() {
        let plan = Self.plan(Self.source)
        let boxes = Self.shapes(of: plan, .rect)

        for (caption, box) in zip(plan.captions.prefix(2), boxes) {
            #expect(box.contains(caption.rect))
        }
    }

    /// The arrow runs from one lifeline to the other, and its word is written above it rather than
    /// on it.
    @Test
    func `a message runs between the two lifelines it names`() {
        let plan = Self.plan("A->>B: hello")
        let lines = Self.lifelines(of: plan)
        let arrow = Self.paths(of: plan).first { $0.count == 2 && $0[0].y == $0[1].y }

        #expect(arrow?[0].x == lines[0][0].x)
        #expect(arrow?[1].x == lines[1][0].x)
        #expect(plan.captions[2].rect.maxY <= (arrow?[0].y ?? 0))
    }

    @Test
    func `a message written the other way runs the other way`() {
        let plan = Self.plan("A->>B: one\nB->>A: two")
        let arrows = Self.paths(of: plan).filter { $0.count == 2 && $0[0].y == $0[1].y }

        #expect(arrows.count == 2)
        #expect(arrows[0][0].x < arrows[0][1].x)
        #expect(arrows[1][0].x > arrows[1][1].x)
    }

    /// A self-message loops out of its own lifeline and back, and it must not reach the one next
    /// door — the whole column is widened for it rather than the loop drawn over a stranger.
    @Test
    func `a self message loops back without touching the lifeline next door`() {
        let plan = Self.plan("A->>A: think\nA->>B: go")
        let lines = Self.lifelines(of: plan)
        let loop = Self.paths(of: plan).first { $0.count == 4 }

        #expect(loop != nil)
        #expect(loop?.first?.y != loop?.last?.y)
        #expect(loop?.map(\.x).max() ?? 0 < lines[1][0].x)
    }

    @Test(arguments: ["A->>B: filled", "A-)B: open", "A-xB: cross"])
    func `an arrow with a mark on its end draws one`(line: String) {
        let plan = Self.plan(line)

        #expect(plan.figures.count > Self.plan("A->B: none").figures.count)
    }

    @Test
    func `a plain arrow draws no mark at all`() {
        let heads = Self.plan("A->B: none").figures.filter {
            if case .arrowhead = $0.form {
                true
            } else {
                false
            }
        }

        #expect(heads.isEmpty)
    }

    /// A dotted line and a solid one have to be told apart at a glance, and colour is not how — a
    /// diagram is one ink.
    @Test
    func `a dotted message is stroked differently from a solid one`() {
        let dotted = Self.plan("A-->>B: reply").figures.filter { $0.line == .dotted }
        let solid = Self.plan("A->>B: call").figures.filter { $0.line == .dotted }

        // Both diagrams draw two dotted lifelines; only the first adds a dotted message.
        #expect(dotted.count == solid.count + 1)
    }
}
