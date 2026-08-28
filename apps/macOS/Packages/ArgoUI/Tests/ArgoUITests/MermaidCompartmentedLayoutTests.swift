@testable import ArgoUI
import Foundation
import Testing

/// Where a compartmented diagram's boxes are placed, what is drawn at the ends of the lines
/// between them, and where the words against those ends go.
///
/// The layout itself is the flowchart's — ranked, ordered, placed and routed by `MermaidLayered` —
/// so what is claimed here is what a class and an entity add to it: a ruled box, a terminal mark
/// that says which relationship this is, and a word standing against the box it belongs to (#865).
@MainActor
@Suite("Mermaid compartmented layout")
struct MermaidCompartmentedLayoutTests {
    static func plan(_ source: String) -> MermaidPlan {
        guard let diagram = MermaidDiagram.read(source) else {
            Issue.record("the diagram was not read: \(source)")
            return .empty
        }
        return diagram.laid
    }

    static func boxes(of plan: MermaidPlan) -> [CGRect] {
        plan.figures.compactMap {
            guard case let .shape(.rect, rect) = $0.form else { return nil }
            return rect
        }
    }

    /// Every polyline the plan drew, in the order it drew them.
    static func paths(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap {
            guard case let .path(points) = $0.form else { return nil }
            return points
        }
    }

    static func polygons(of plan: MermaidPlan) -> [[CGPoint]] {
        plan.figures.compactMap {
            guard case let .polygon(points) = $0.form else { return nil }
            return points
        }
    }

    /// A class is one box with a rule between its name and its members, and a caption for each.
    @Test
    func `a class is a box ruled between its name and its members`() {
        let plan = Self.plan("classDiagram\nclass Session {\n+String id\n+resume()\n}")

        guard let box = Self.boxes(of: plan).first else {
            return #expect(Bool(false), "the class was drawn")
        }
        #expect(plan.captions.map(\.label.text).prefix(3)
            == ["Session", "+String id", "+resume()"])
        // Two rules: under the name, and under the attributes — three bands, two separations.
        let rules = Self.paths(of: plan).filter {
            $0.count == 2 && $0[0].y == $0[1].y && $0[0].x == box.minX && $0[1].x == box.maxX
        }
        #expect(rules.count == 2)
        #expect(rules.allSatisfy { $0[0].y > box.minY && $0[0].y < box.maxY })
    }

    /// A member sits flush left under the name it belongs to, which is centred.
    @Test
    func `a name is centred and its members are not`() {
        let plan = Self.plan("classDiagram\nclass Session {\n+String identifier\n}")

        #expect(plan.captions.first?.alignment == .middle)
        #expect(plan.captions.dropFirst().first?.alignment == .leading)
    }

    /// The mark that says which relationship this is. Inheritance is a HOLLOW triangle — a closed
    /// run of points that is stroked — and composition is a FILLED diamond. The two the other way
    /// round would say the opposite of what the author wrote and still look like a diagram.
    @Test
    func `inheritance draws a hollow triangle and composition a filled diamond`() {
        let parent = Self.plan("classDiagram\nAnimal <|-- Duck")
        let whole = Self.plan("classDiagram\nCar *-- Wheel")

        #expect(Self.polygons(of: parent).isEmpty)
        // Four points, the last repeating the first: a triangle drawn as an outline.
        let triangle = Self.paths(of: parent).first { $0.count == 4 && $0[0] == $0[3] }
        #expect(triangle != nil)
        #expect(Self.polygons(of: whole).contains { $0.count == 4 })
    }

    /// Aggregation is the same diamond, hollow — so the pair differs in fill alone and nothing
    /// else has to be read to tell a part from a share.
    @Test
    func `aggregation draws the same diamond hollow`() {
        let plan = Self.plan("classDiagram\nTeam o-- Player")

        #expect(Self.polygons(of: plan).isEmpty)
        #expect(Self.paths(of: plan).contains { $0.count == 5 && $0[0] == $0[4] })
    }

    /// A dashed relationship draws a dashed LINE and a whole mark. Dashing the mark too would break
    /// the one figure that says which relationship this is into strokes nobody can read.
    @Test
    func `a realisation's triangle is stroked solid under a dashed line`() {
        let plan = Self.plan("classDiagram\nShape <|.. Square")
        let marks = plan.figures.filter {
            guard case let .path(points) = $0.form else { return false }
            return points.count == 4
        }

        #expect(marks.count == 1)
        #expect(marks.allSatisfy { $0.line == .solid })
        #expect(plan.figures.contains { $0.line == .dotted })
    }

    /// The terminal really stands at the box it belongs to, and the line stops behind it.
    @Test
    func `a marker stands against the class the token named`() {
        let plan = Self.plan("classDiagram\nAnimal <|-- Duck")
        let boxes = Self.boxes(of: plan)

        guard boxes.count == 2, let triangle = Self.paths(of: plan)
            .first(where: { $0.count == 4 && $0[0] == $0[3] }) else {
            return #expect(Bool(false), "both classes and the marker were drawn")
        }
        // `Animal` is the parent, so it ranks first and the triangle touches ITS face.
        let parent = boxes.min { $0.minY < $1.minY } ?? .zero
        #expect(abs(triangle[0].y - parent.maxY) < 1)
    }

    /// A cardinality stands against the box it was written beside, not in the middle of the line.
    @Test
    func `a cardinality stands against its own end`() {
        let plan = Self.plan("classDiagram\nUser \"1\" --> \"0..*\" Order : places")
        let words = Dictionary(
            plan.captions.map { ($0.label.text, $0.rect) }, uniquingKeysWith: { first, _ in first },
        )

        guard let one = words["1"], let many = words["0..*"], let label = words["places"] else {
            return #expect(Bool(false), "all three words were set")
        }
        // `User` ranks above `Order`, so its own cardinality is the higher of the two.
        #expect(one.midY < label.midY)
        #expect(label.midY < many.midY)
    }

    /// Crow's foot: many is a fork of three strokes at the entity's face, one is a single bar.
    @Test
    func `crows foot draws a fork for many and a bar for one`() {
        let plan = Self.plan("erDiagram\nCUSTOMER ||--o{ ORDER : places")
        let bars = Self.paths(of: plan).filter { $0.count == 2 }

        // The fork's own two strokes, plus the connector and both ends' minimum marks.
        #expect(Self.paths(of: plan).contains { $0.count == 3 })
        #expect(bars.count > 1)
        // One ring for the "zero" minimum on the many end and none on the one end, drawn
        // as the pair of figures its ink demands — which the test below is about.
        #expect(plan.figures.count {
            if case .shape(.ellipse, _) = $0.form {
                true
            } else {
                false
            }
        }
            == 2)
    }

    /// The ring that says "zero" is drawn in the ink the fork beside it is drawn in. `}o` and `}|`
    /// differ in this mark ALONE, so a ring at the node's own quieter stroke says "one or more"
    /// where the source said "zero or more" — and still looks like a diagram.
    @Test
    func `the zero ring is drawn in the connector's own ink`() {
        let plan = Self.plan("erDiagram\nCUSTOMER ||--o{ ORDER : places")
        let rings = plan.figures.filter {
            guard case .shape(.ellipse, _) = $0.form else { return false }
            return true
        }

        // Two figures over one circle: the box's ground under it, the connector's ink over that.
        #expect(rings.count == 2)
        #expect(rings.map(\.role) == [.node, .edge])
        #expect(rings.first?.form.bounds == rings.last?.form.bounds)
        // The ink the ring takes is the ink the fork beside it takes.
        let fork = plan.figures.first {
            if case let .path(points) = $0.form {
                points.count == 3
            } else {
                false
            }
        }
        #expect(fork?.role == rings.last?.role)
    }

    /// Both diagram types come through ONE renderer, so an entity's box is ruled the same way a
    /// class's is.
    @Test
    func `an entity is drawn by the same compartment renderer`() {
        let plan = Self.plan("erDiagram\nCUSTOMER {\nstring name\n}")

        guard let box = Self.boxes(of: plan).first else {
            return #expect(Bool(false), "the entity was drawn")
        }
        #expect(plan.captions.map(\.label.text) == ["CUSTOMER", "string name"])
        #expect(Self.paths(of: plan).contains {
            $0.count == 2 && $0[0].x == box.minX && $0[1].x == box.maxX
        })
    }

    /// The captions the model promises are the captions the plan places, in that very order — the
    /// contract `MermaidLayout` pairs `Text` views to figures by.
    @Test(arguments: [
        "classDiagram\nclass Session {\n+String id\n+resume()\n}"
            + "\nSession \"1\" --> \"*\" Turn : holds",
        "erDiagram\nCUSTOMER ||--o{ ORDER : places\nORDER {\nint id PK\n}",
    ])
    func `every label the model states is placed by the plan`(source: String) {
        guard let diagram = MermaidDiagram.read(source) else {
            return #expect(Bool(false), "the diagram was read")
        }

        #expect(diagram.laid.captions.map(\.label.text) == diagram.labels.map(\.text))
    }
}
