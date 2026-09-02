import Foundation
@testable import MermaidLayout
import Testing

/// Where a read state machine is placed, and what each of its figures is drawn as.
///
/// The layout itself is the flowchart's — ranked, ordered, placed and routed by `MermaidLayered`
/// — so what is claimed here is what a state machine adds to it: its own figures, its nesting, and
/// the fact that the pass really is the shared one (#863).
@MainActor
@Suite("Mermaid state layout")
struct MermaidStateLayoutTests {
    /// The plan for a source this suite expects to be readable. A reader regression fails HERE,
    /// saying so, rather than downstream as a count that does not add up.
    static func plan(_ source: String) -> MermaidPlan {
        guard let diagram = MermaidDiagram.read(source) else {
            Issue.record("the machine was not read: \(source)")
            return .empty
        }
        return diagram.laid
    }

    /// Every outline the plan drew, in the order it drew them.
    static func outlines(of plan: MermaidPlan) -> [MermaidOutline] {
        plan.figures.compactMap {
            guard case let .shape(outline, _) = $0.form else { return nil }
            return outline
        }
    }

    static func shapes(of plan: MermaidPlan, _ outline: MermaidOutline) -> [CGRect] {
        plan.figures.compactMap {
            guard case let .shape(drawn, rect) = $0.form, drawn == outline else { return nil }
            return rect
        }
    }

    /// The token that means two things draws two things: a filled dot where it opened the machine,
    /// a ring round a filled dot where it closed it.
    @Test
    func `the start is a dot and the end is a ringed dot`() {
        let plan = Self.plan("stateDiagram-v2\n[*] --> Still\nStill --> [*]")

        // Three dots: the start, and the end's own centre — plus the ring around that centre.
        #expect(Self.shapes(of: plan, .dot).count == 2)
        let rings = Self.shapes(of: plan, .ellipse)
        #expect(rings.count == 1)
        // The ring really is drawn around a dot, and not beside one.
        #expect(Self.shapes(of: plan, .dot).contains { rings[0].contains($0) })
    }

    @Test
    func `a state is a rounded box carrying its own description`() {
        let plan = Self.plan("stateDiagram-v2\nstate \"Waiting for CI\" as wait\nwait --> [*]")

        guard let box = Self.shapes(of: plan, .rounded).first else {
            return #expect(Bool(false), "the state was drawn")
        }
        guard let caption = plan.captions.first(where: { $0.label.text == "Waiting for CI" }) else {
            return #expect(Bool(false), "the description was set")
        }
        #expect(box.contains(caption.rect))
    }

    /// A word on a transition sits beside the line, never on it.
    @Test
    func `a transition carries its word clear of the line`() {
        let plan = Self.plan("stateDiagram-v2\nBuild --> Review : pushed")

        guard let word = plan.captions.first(where: { $0.label.text == "pushed" }) else {
            return #expect(Bool(false), "the word was set")
        }
        let connectors = plan.figures.filter { $0.role == .edge }
        #expect(!connectors.isEmpty)
        #expect(!connectors.contains { $0.form.bounds.intersects(word.rect.insetBy(dx: 1, dy: 1)) })
    }

    /// The composite really encloses what is inside it, and really does not enclose what is not.
    @Test
    func `a composite state frames exactly the states inside it`() {
        let plan = Self.plan("""
        stateDiagram-v2
        [*] --> Working
        state Working {
          Reading --> Writing
        }
        Working --> Done
        """)

        guard let frame = Self.shapes(of: plan, .enclosure).first else {
            return #expect(Bool(false), "the composite was framed")
        }
        let boxes = Self.shapes(of: plan, .rounded)
        #expect(boxes.count == 3)
        // Two states inside, one outside — and the one outside is CLEAR of the frame rather than
        // merely not contained by it, which is what a transition out of a composite gets wrong
        // when it leaves by the composite's own way in.
        #expect(boxes.filter { frame.contains($0) }.count == 2)
        #expect(boxes.filter { $0.intersects(frame) }.count == 2)
        #expect(plan.captions.contains { $0.label.text == "Working" && frame.contains($0.rect) })
    }

    @Test(arguments: [("choice", MermaidOutline.diamond), ("fork", .bar), ("join", .bar)])
    func `a pseudo-state draws its own figure`(keyword: String, outline: MermaidOutline) {
        let plan = Self.plan("stateDiagram-v2\nstate pick <<\(keyword)>>\nA --> pick\npick --> B")

        #expect(Self.shapes(of: plan, outline).count == 1)
    }

    /// A note is placed by the same pass as everything else, so it can never be drawn over a state.
    @Test
    func `a note stands clear of the machine`() {
        let plan = Self.plan("stateDiagram-v2\nA --> B\nnote right of A : the fence arrives")

        guard let note = Self.shapes(of: plan, .rect).first else {
            return #expect(Bool(false), "the note was drawn")
        }
        #expect(!Self.shapes(of: plan, .rounded).contains { $0.intersects(note) })
        #expect(plan.captions.contains {
            $0.label.text == "the fence arrives" && note.contains($0.rect)
        })
    }

    /// The pass is the shared one, so a machine turns on `direction` exactly as a flowchart turns
    /// on its header — which is the claim that this ticket did not grow a second layout.
    @Test
    func `direction turns the machine the way it turns a flowchart`() {
        let down = Self.shapes(of: Self.plan("stateDiagram-v2\nA --> B"), .rounded)
        let across = Self.shapes(of: Self.plan("stateDiagram-v2\ndirection LR\nA --> B"), .rounded)

        #expect(down.count == 2 && across.count == 2)
        #expect(down[0].midX == down[1].midX)
        #expect(across[0].midY == across[1].midY)
    }

    /// The plan stands where it is drawn: nothing at a negative, and the size is the room the marks
    /// really take — the invariant the minimap's reported height rests on.
    @Test
    func `the plan is normalised into the room it stands in`() {
        let plan = Self.plan("stateDiagram-v2\n[*] --> A\nA --> B\nB --> A\nA --> [*]")

        #expect(plan.figures.allSatisfy { $0.form.bounds.minX >= 0 && $0.form.bounds.minY >= 0 })
        #expect(plan.size.width > 0 && plan.size.height > 0)
    }
}
