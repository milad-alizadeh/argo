@testable import ArgoUI
import Foundation
import Testing

/// Where several edges leaving one box by the same face actually meet it.
///
/// The claim is not cosmetic. A class diagram says composition with a filled diamond and
/// aggregation with a hollow one, and two of them stacked on one midpoint draw ONE mark — the
/// reader sees one relationship where two were written and reads the survivor's meaning onto both.
/// That is the one place a diagram here draws confidently and wrongly (#920).
///
/// The other half of the claim is that the common case pays nothing: a box with one edge per face
/// still meets it at the middle, to the point.
@MainActor
@Suite("Mermaid exit fan")
struct MermaidExitFanTests {
    /// Two edges leaving one face meet it at two points, both still on the face.
    @Test
    func `two edges leaving one face attach at different points`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> B\nA --> C")
        let starts = Self.starts(of: plan)

        guard let box = MermaidLayoutTests.boxes(of: plan).first, starts.count == 2 else {
            return #expect(Bool(false), "both connectors were drawn")
        }
        #expect(starts[0].x != starts[1].x)
        #expect(starts.allSatisfy { abs($0.y - box.maxY) < 1 })
        #expect(starts.allSatisfy { $0.x > box.minX && $0.x < box.maxX })
    }

    /// The far ends' own order across their rank decides the order along the face, so the lines
    /// stay parallel rather than swapping over.
    @Test
    func `the exits run in the order of the boxes they reach`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> First\nA --> Second\nA --> Third")
        let starts = Self.starts(of: plan)
        let ends = Self.paths(of: plan).compactMap(\.last)

        #expect(Set(starts.map(\.x)).count == 3)
        #expect(starts.map(\.x) == starts.map(\.x).sorted())
        #expect(ends.map(\.x) == ends.map(\.x).sorted())
    }

    /// A box with one edge per face meets it in the middle, exactly as it did before there was a
    /// fan at all. The common case pays nothing.
    @Test
    func `one edge per face still leaves by the middle of it`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA --> B\nB --> C")
        let boxes = MermaidLayoutTests.boxes(of: plan)
        let starts = Self.starts(of: plan)

        guard boxes.count == 3, starts.count == 2 else {
            return #expect(Bool(false), "every box and both connectors were drawn")
        }
        #expect(starts[0].x == boxes[0].midX)
        #expect(starts[1].x == boxes[1].midX)
        #expect(Self.paths(of: plan).allSatisfy { $0.count == 2 })
    }

    /// A fanned exit stays inside the face it fans along, however many edges share it — a stem
    /// leaving past the corner reads as belonging to the box next door.
    @Test
    func `a crowded face keeps every exit on itself`() {
        let plan = MermaidLayoutTests
            .plan("graph LR\nA --> B\nA --> C\nA --> D\nA --> E\nA --> F\nA --> G")
        let starts = Self.starts(of: plan)

        guard let box = MermaidLayoutTests.boxes(of: plan).first else {
            return #expect(Bool(false), "the box was drawn")
        }
        #expect(starts.count == 6)
        #expect(starts.allSatisfy { $0.y > box.minY && $0.y < box.maxY })
        #expect(Set(starts.map(\.y)).count == 6)
    }

    /// Every direction fans the face its own ranks leave by, along its own axis. `BT` and `RL`
    /// run the ranks backwards, so the face an edge leaves by is the one at the other end of the
    /// box — a single inverted flag, and nothing else in the suite would catch it turned over.
    @Test(arguments: [
        ("TD", false, true), ("BT", false, false), ("LR", true, true), ("RL", true, false),
    ])
    func `each direction fans the face its ranks leave by`(
        direction: String,
        isHorizontal: Bool,
        isForward: Bool,
    ) {
        let plan = MermaidLayoutTests.plan("graph \(direction)\nA --> B\nA --> C")
        let starts = Self.starts(of: plan)

        guard let box = MermaidLayoutTests.boxes(of: plan).first, starts.count == 2 else {
            return #expect(Bool(false), "the box and both connectors were drawn")
        }
        let face = isHorizontal
            ? (isForward ? box.maxX : box.minX)
            : (isForward ? box.maxY : box.minY)
        #expect(starts.allSatisfy { abs((isHorizontal ? $0.x : $0.y) - face) < 1 })
        // Fanned ACROSS the ranks, which is the other axis from the one they grow along.
        #expect(Set(starts.map { isHorizontal ? $0.y : $0.x }).count == 2)
    }

    /// A crowded face gives up the STEP and never the face. The marks at either end of a fan have
    /// to stand on the box, so what the gaps share is the span less one whole mark — an entity
    /// with three relationships off one narrow face is exactly the case that used to overlap them.
    @Test
    func `a narrow face keeps its outermost marks on the box`() {
        // A two-letter name, so the box stands at the NARROWEST a box is drawn — the case the old
        // arithmetic gave a step of 11 to and drew three 12-wide marks overlapping. No members, so
        // the only paths the plan holds are the three connectors themselves.
        let plan = MermaidCompartmentedLayoutTests
            .plan("classDiagram\nAx --> One\nAx --> Two\nAx --> Six")
        let starts = Self.starts(of: plan).sorted { $0.x < $1.x }

        guard let hub = MermaidCompartmentedLayoutTests.boxes(of: plan).first, starts.count == 3
        else {
            return #expect(Bool(false), "the class and all three lines were drawn")
        }
        let steps = zip(starts, starts.dropFirst()).map { $1.x - $0.x }
        #expect(steps.allSatisfy { $0 >= MermaidMeasure.footWidth })
        #expect(starts[0].x - MermaidMeasure.footWidth / 2 >= hub.minX - 0.5)
        #expect(starts[2].x + MermaidMeasure.footWidth / 2 <= hub.maxX + 0.5)
    }

    /// A figure that does not fill its box keeps the middle of its face for every end. A diamond
    /// touches its box at the midpoint of a face and falls away either side, so a fanned stem
    /// would start in the air beside the shape — which is what the render showed, and no test
    /// could, until this was a rule the reader states (#920).
    @Test
    func `a shape that does not fill its box keeps the middle`() {
        let plan = MermaidLayoutTests.plan("graph TD\nA{Which kind?} --> B\nA --> C")
        let starts = Self.starts(of: plan)

        guard let diamond = MermaidLayoutTests.boxes(of: plan).first, starts.count == 2 else {
            return #expect(Bool(false), "the diamond and both connectors were drawn")
        }
        #expect(starts[0] == starts[1])
        #expect(starts[0] == CGPoint(x: diamond.midX, y: diamond.maxY))
    }

    /// A composition and an aggregation on one box are two marks at two points. This is the whole
    /// of #920: the hollow diamond used to be drawn under the filled one and lost.
    @Test
    func `a composition and an aggregation on one box are both drawn`() {
        let plan = MermaidCompartmentedLayoutTests
            .plan("classDiagram\nDiagram *-- Box\nDiagram o-- Relation")
        let filled = MermaidCompartmentedLayoutTests.polygons(of: plan).first { $0.count == 4 }
        let hollow = MermaidCompartmentedLayoutTests.paths(of: plan)
            .first { $0.count == 5 && $0[0] == $0[4] }

        guard let filled, let hollow else {
            return #expect(Bool(false), "both diamonds were drawn")
        }
        #expect(filled[0] != hollow[0])
    }

    /// Every connector, by the point it leaves its box at. The tail of a flowchart's link carries
    /// no cap, so the stroke really does start on the face.
    private static func starts(of plan: MermaidPlan) -> [CGPoint] {
        paths(of: plan).compactMap(\.first)
    }

    private static func paths(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap { figure in
            guard case let .path(points) = figure.form else { return nil }
            return points
        }
    }
}
