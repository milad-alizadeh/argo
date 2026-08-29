@testable import ArgoUI
import Foundation
import Testing

/// The fan on the face a BACK edge uses, and the lanes those edges run out in.
///
/// Its own suite because a back edge answers to neither of the rules the rest of the fan does: it
/// leaves and re-enters by the flank rather than by the faces looking up and down the ranks, it
/// fans along the other axis, and where its end stands is decided by the lane it runs in rather
/// than by anything about the box at the far end (#920).
@MainActor
@Suite("Mermaid back-edge fan")
struct MermaidBackFanTests {
    /// Two edges closing the same loop arrive at one flank as TWO arrowheads. Drawn on one point
    /// they read as a single arrival, which is one of the two edges the source wrote gone.
    @Test
    func `two back edges arrive at one flank at two points`() {
        let plan = Self.loops

        guard let build = MermaidLayoutTests.boxes(of: plan).first else {
            return #expect(Bool(false), "the node the loops close on was drawn")
        }
        // `Build` is the node both closing edges answer, and in `TD` they re-enter by its left
        // flank — so its own face is where the two arrivals either separate or do not.
        let arrivals = Self.heads(of: plan).filter { abs($0.x - build.minX) < 1 }
        #expect(arrivals.count == 2)
        #expect(Set(arrivals.map(\.y)).count == 2)
    }

    /// The lane a back edge runs in and the place its end takes on the flank are ONE fact. Ordered
    /// on anything else, the outer lane's run in to the box cuts across the inner lane's own line
    /// — a crossing the midpoint exit never had.
    @Test
    func `the outer lane arrives without crossing the inner one`() {
        #expect(Self.crossings(of: Self.loops) == 0)
    }

    /// A self-loop leaves and re-enters by two points of its own flank, so it draws a loop rather
    /// than the degenerate line it drew when both ends stood on one point.
    @Test
    func `a self-loop leaves and re-enters at two points`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> A")

        guard let line = Self.lines(of: plan).first else {
            return #expect(Bool(false), "the loop was drawn")
        }
        #expect(line.first != line.last)
        #expect(Set(line.map(\.x)).count > 1)
    }

    /// Two self-loops on one node get a lane each, the same way two edges closing one loop do.
    /// Sharing a lane draws one loop over the other, which is an edge the source wrote that
    /// nobody can see.
    @Test
    func `two self-loops run in lanes of their own`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> A\nA --> A")
        let leftmost = MermaidLayoutTests.boxes(of: plan).map(\.minX).min() ?? 0
        let lanes = Set(Self.lines(of: plan).map { $0.map(\.x).min() ?? 0 }.filter {
            $0 < leftmost
        })

        #expect(lanes.count == 2)
    }

    /// A cycle, and the two edges that close it — the fixture both claims above are about.
    private static var loops: MermaidPlan {
        MermaidLayoutTests
            .plan("graph TD\nBuild --> Review\nReview --> Build\nReview --> Land\nLand --> Build")
    }

    private static func heads(of plan: MermaidPlan) -> [CGPoint] {
        plan.figures.compactMap { figure in
            guard case let .arrowhead(tip, _) = figure.form else { return nil }
            return tip
        }
    }

    private static func lines(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap { figure in
            guard case let .path(points) = figure.form else { return nil }
            return points
        }
    }

    /// Every pair of connector segments that really meet, on the plan the reader sees.
    private static func crossings(of plan: MermaidPlan) -> Int {
        let runs = lines(of: plan).flatMap { zip($0, $0.dropFirst()).map(\.self) }
        return runs.indices.reduce(0) { total, one in
            total + runs[(one + 1)...].count { MermaidSegments.cross(runs[one], $0) }
        }
    }
}
