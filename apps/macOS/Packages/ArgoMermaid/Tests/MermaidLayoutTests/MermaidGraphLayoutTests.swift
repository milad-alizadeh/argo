import Foundation
@testable import MermaidLayout
import Testing

/// The three things a layered layout has to get right that a single rank never exercises: which
/// axis the ranks grow along, what a `subgraph` encloses, and what happens when the graph loops.
///
/// The crossing count has its own claim and its own fixtures. It is the number the ordering pass
/// exists to lower, so it is the one thing here that can regress in silence: a diagram that crosses
/// more still draws, and still draws every edge.
@MainActor
@Suite("Mermaid graph layout")
struct MermaidGraphLayoutTests {
    nonisolated static let fork = "A --> B\nA --> C\nB --> D\nC --> D"

    /// Each direction grows its ranks along its own axis, and rank zero stands at the end that
    /// direction starts from.
    @Test(arguments: [
        ("TD", false, true), ("BT", false, false), ("LR", true, true), ("RL", true, false),
    ])
    func `each direction lays out along its own axis`(
        direction: String,
        isHorizontal: Bool,
        isForward: Bool,
    ) {
        let boxes = MermaidLayoutTests.boxes(of: MermaidLayoutTests
            .plan("graph \(direction)\nA --> B"))

        guard boxes.count == 2 else { return #expect(Bool(false), "both nodes were placed") }
        let (first, second) = (boxes[0], boxes[1])
        if isHorizontal {
            #expect(first.midY == second.midY)
            #expect((first.midX < second.midX) == isForward)
        } else {
            #expect(first.midX == second.midX)
            #expect((first.midY < second.midY) == isForward)
        }
    }

    /// An enclosure contains exactly its members and nothing it does not own, and its title stands
    /// inside the frame rather than over a node.
    @Test
    func `a subgraph draws a titled frame around exactly its members`() {
        let plan = MermaidLayoutTests
            .plan("graph TD\nsubgraph Reading\nA --> B\nend\nB --> C")
        let boxes = MermaidLayoutTests.boxes(of: plan)

        guard let frame = Self.enclosure(of: plan), boxes.count == 3 else {
            return #expect(Bool(false), "the frame and every node were placed")
        }
        #expect(frame.contains(boxes[0]))
        #expect(frame.contains(boxes[1]))
        #expect(!frame.intersects(boxes[2]))
        #expect(plan.captions.last.map { frame.contains($0.rect) } == true)
        #expect(plan.captions.last?.label.text == "Reading")
    }

    /// Cohesion survives the ordering sweeps and not only the pass that sets them up, so a group's
    /// members stand together on their rank and the frame around them clears the stranger beside
    /// them.
    ///
    /// That is narrower than the guarantee an enclosure would want. A group spanning ranks a
    /// stranger ALSO stands in can still be framed around it — see `MermaidPlacement` for why a
    /// lane per group is not the answer, and #861 for the compound layout that is.
    @Test
    func `a group's members stand together on the rank they share`() {
        let plan = MermaidLayoutTests.plan("""
        graph TD
        Top --> Beside
        Top --> One
        Top --> Two
        subgraph Held
        One --> Down
        Two --> Down
        end
        """)
        let boxes = MermaidLayoutTests.boxes(of: plan)

        guard let frame = Self.enclosure(of: plan), boxes.count == 5 else {
            return #expect(Bool(false), "the frame and every node were placed")
        }
        // `Beside` is the one node of its rank the group does not own.
        #expect(!frame.intersects(boxes[1]))
        #expect(frame.contains(boxes[2]))
        #expect(frame.contains(boxes[3]))
    }

    /// A cycle is a source somebody really writes. It has to lay out at the ranks its forward edges
    /// give it rather than hang, which is what an unbroken ranking pass would do.
    @Test
    func `a cycle lays out at the ranks its forward edges give it`() {
        let boxes = MermaidLayoutTests.boxes(of: Self.loop)

        #expect(boxes.count == 3)
        #expect(boxes.map(\.minY) == boxes.map(\.minY).sorted())
    }

    /// Breaking the cycle is a RANKING device. The edge that closes it is still an edge, and it is
    /// still drawn.
    @Test
    func `a cycle keeps every edge it was written with`() {
        #expect(Self.loop.figures.count(where: Self.isHead) == 3)
    }

    private static var loop: MermaidPlan {
        MermaidLayoutTests.plan("graph TD\nA --> B\nB --> C\nC --> A")
    }

    private static func isHead(_ figure: MermaidFigure) -> Bool {
        if case .arrowhead = figure.form {
            true
        } else {
            false
        }
    }

    /// The closing edge of a cycle runs in a lane OUTSIDE the ranks, so it never shares a line with
    /// the forward edges it is answering.
    @Test
    func `a cycle's closing edge runs outside the boxes`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> B\nB --> A")
        let lanes = Self.lines(of: plan).map { points in points.map(\.x).min() ?? 0 }
        let leftmost = MermaidLayoutTests.boxes(of: plan).map(\.minX).min() ?? 0

        #expect(lanes.contains { $0 < leftmost })
    }

    /// Two edges closing the same loop get a lane each. Drawn on top of each other they read as one
    /// edge, and the other is an edge the source wrote that nobody can see.
    @Test
    func `two back edges run in lanes of their own`() {
        let plan = MermaidLayoutTests
            .plan("graph TD\nBuild --> Review\nReview --> Build\nReview --> Land\nLand --> Build")
        let leftmost = MermaidLayoutTests.boxes(of: plan).map(\.minX).min() ?? 0
        let lanes = Set(Self.lines(of: plan)
            .map { points in points.map(\.x).min() ?? 0 }
            .filter { $0 < leftmost })

        #expect(lanes.count == 2)
    }

    @Test
    func `a self-loop lays out rather than vanishing`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> A")

        #expect(MermaidLayoutTests.boxes(of: plan).count == 1)
        #expect(!Self.lines(of: plan).isEmpty)
    }

    /// The pass that orders each rank exists to lower this number, and nothing else reports it. A
    /// fixture whose count creeps up still draws every edge, so only a recorded budget catches it.
    @Test(arguments: [
        ("graph TD\n\(fork)", 0),
        ("graph TD\nA --> C\nB --> C\nA --> D\nB --> D", 1),
        ("graph LR\nA --> X\nB --> Y\nC --> Z\nA --> Z\nC --> X", 1),
        ("graph TD\nRead --> Write\nWrite --> Read", 0),
        ("graph TD\nsubgraph One\nA --> C\nend\nB --> C\nB --> D\nA --> D", 1),
    ])
    func `no fixture crosses more edges than it is budgeted`(source: String, budget: Int) {
        #expect(Self.crossings(of: MermaidLayoutTests.plan(source)) <= budget)
    }

    /// Every pair of connector segments that actually meet, counted on the PLAN rather than on the
    /// ranks — which is what a reader sees, and the only count a routing change cannot quietly
    /// redefine.
    private static func crossings(of plan: MermaidPlan) -> Int {
        let runs = lines(of: plan).flatMap { points in zip(points, points.dropFirst()).map(\.self) }
        return runs.indices.reduce(0) { total, one in
            total + runs[(one + 1)...].count { other in
                MermaidSegments.cross(runs[one], other)
            }
        }
    }

    private static func lines(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap { figure in
            guard case let .path(points) = figure.form else { return nil }
            return points
        }
    }

    private static func enclosure(of plan: MermaidPlan) -> CGRect? {
        plan.figures.compactMap { figure -> CGRect? in
            guard case let .shape(.enclosure, rect) = figure.form else { return nil }
            return rect
        }.first
    }
}

/// Whether two line segments meet at a point inside both of them. Its own type because a crossing
/// count is only as trustworthy as the predicate under it.
enum MermaidSegments {
    static func cross(_ one: (CGPoint, CGPoint), _ other: (CGPoint, CGPoint)) -> Bool {
        let sides = [
            side(one.0, one.1, other.0), side(one.0, one.1, other.1),
            side(other.0, other.1, one.0), side(other.0, other.1, one.1),
        ]
        // Strictly opposite on both, so segments merely touching end to end do not count — every
        // edge leaving one box shares its start with every other edge leaving it.
        return sides[0] * sides[1] < 0 && sides[2] * sides[3] < 0
    }

    private static func side(_ from: CGPoint, _ to: CGPoint, _ point: CGPoint) -> CGFloat {
        (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)
    }
}
