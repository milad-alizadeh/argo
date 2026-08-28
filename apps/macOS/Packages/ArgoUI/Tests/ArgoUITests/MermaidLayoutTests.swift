@testable import ArgoUI
import Foundation
import Testing

/// Where a read diagram is placed. The claims are the ones a reader would make with their eyes on
/// it: no two boxes on top of each other, every label inside the box it names, and the same
/// diagram in the same place every time it is laid out.
@MainActor
@Suite("Mermaid layout")
struct MermaidLayoutTests {
    private static let measure: CGFloat = 620 - ArgoFeedRow.inset * 2

    private static func plan(_ source: String) -> MermaidPlan {
        MermaidDiagram.read(source)?.laid(across: measure) ?? .empty
    }

    /// Three ranks and a fork, so the suite has both a stack and a row in it.
    private static let source = "graph TD\nA --> B\nA --> C\nB --> D\nC --> D"

    @Test
    func `no two nodes overlap`() {
        let boxes = Self.plan(Self.source).figures.compactMap { figure -> CGRect? in
            guard case let .roundedRect(rect) = figure.form else { return nil }
            return rect
        }

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

    /// The pairing the view rests on: it builds one `Text` per label and places it on the caption
    /// at the same index.
    @Test
    func `captions carry the diagram's labels, in order`() {
        let diagram = MermaidDiagram.read(Self.source)

        #expect(Self.plan(Self.source).captions.map(\.label) == diagram?.labels)
    }

    @Test
    func `every caption is measured into the box it names`() {
        let plan = Self.plan(Self.source)

        for caption in plan.captions {
            #expect(plan.figures.contains(MermaidFigure(form: .roundedRect(caption.rect))))
        }
    }

    /// An edge leaves the foot of the box above and ends in a head on the top of the box below, so
    /// the arrow lands ON the node rather than inside it — and the line stops short of its own
    /// head.
    @Test
    func `an edge is drawn as a connector and its head`() {
        let plan = Self.plan("graph TD\nA --> B")
        let boxes = plan.captions.map(\.rect)

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

    /// A diagram narrower than the column takes the column, so what it is centred in is what the
    /// prose around it is set in.
    @Test
    func `the plan fills the measure it was laid out across`() {
        let plan = Self.plan(Self.source)

        #expect(plan.size.width == Self.measure)
        #expect(plan.size.height > 0)
        #expect(plan.figures.allSatisfy { $0.form.bounds.maxY <= plan.size.height })
    }

    /// A cycle is a source somebody really writes. It must settle rather than rank for ever.
    @Test
    func `a cycle is laid out rather than looped on`() {
        #expect(Self.plan("graph TD\nA --> B\nB --> A").captions.count == 2)
    }
}
