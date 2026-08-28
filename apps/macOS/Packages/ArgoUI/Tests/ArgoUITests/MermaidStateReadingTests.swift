@testable import ArgoUI
import Foundation
import Testing

/// What a `stateDiagram-v2` source says, and what it does not.
///
/// The claim the whole ticket rests on is the one about `[*]`: it is ONE token that names TWO
/// figures, and which it is depends only on the end of the transition it sits on. A reader that
/// made it one node would draw a machine that starts where it ends (#863).
@Suite("Mermaid state reading")
struct MermaidStateReadingTests {
    static func read(_ source: String) -> MermaidState? {
        MermaidState.read(source)
    }

    /// The figures of a flat machine, in the order the source named them.
    static func figures(_ source: String) -> [MermaidState.Figure] {
        read(source)?.nodes.map(\.figure) ?? []
    }

    @Test
    func `the start token and the end token are two different figures`() {
        let machine = Self.read("stateDiagram-v2\n[*] --> Still\nStill --> [*]")

        #expect(machine?.nodes.map(\.figure) == [.start, .state, .end])
        #expect(machine?.transitions.count == 2)
        // Two nodes, so a transition INTO the end cannot be drawn as one out of the start.
        #expect(machine?.transitions.first?.to == machine?.nodes[1].name)
        #expect(machine?.transitions.last?.from == machine?.nodes[1].name)
    }

    /// Every source `[*]` in one scope is the same start, and every target `[*]` the same end — so
    /// a machine with two ways in draws one dot, not two.
    @Test
    func `one scope has one start and one end however often the token is written`() {
        let machine = Self.read("stateDiagram-v2\n[*] --> A\n[*] --> B\nA --> [*]\nB --> [*]")

        #expect(machine?.nodes.map(\.figure) == [.start, .state, .state, .end])
    }

    @Test(arguments: [
        ("stateDiagram-v2\nstate \"Waiting for CI\" as wait\nwait --> [*]", "Waiting for CI"),
        ("stateDiagram-v2\nwait --> [*]\nwait : Waiting for CI", "Waiting for CI"),
        ("stateDiagram-v2\nwait --> [*]", "wait"),
    ])
    func `a state carries the description the source gave it`(source: String, label: String) {
        #expect(Self.read(source)?.nodes.first?.label == label)
    }

    @Test
    func `a transition carries the word written on it`() {
        let machine = Self.read("stateDiagram-v2\nBuild --> Review : pushed\nReview --> Land")

        #expect(machine?.transitions.map(\.label) == ["pushed", nil])
    }

    @Test(arguments: [("choice", MermaidState.Figure.choice), ("fork", .fork), ("join", .fork)])
    func `a pseudo-state is its own figure`(keyword: String, figure: MermaidState.Figure) {
        let source = "stateDiagram-v2\nstate pick <<\(keyword)>>\nA --> pick"

        #expect(Self.figures(source) == [figure, .state])
    }

    /// A composite holds exactly the states written inside it, and the states themselves are still
    /// the machine's own — the enclosure is drawn around them, not instead of them.
    @Test
    func `a composite state holds the states written inside it`() {
        let machine = Self.read("""
        stateDiagram-v2
        [*] --> Working
        state Working {
          [*] --> Reading
          Reading --> Writing
        }
        Working --> [*]
        """)

        #expect(machine?.composites.count == 1)
        #expect(machine?.composites.first?.title == "Working")
        let members = machine?.composites.first?.members ?? []
        #expect(members.contains { machine?.node(named: $0)?.label == "Reading" })
        #expect(members.contains { machine?.node(named: $0)?.label == "Writing" })
        // The composite's own `[*]` is that composite's start, and the outer one is the outer.
        #expect(machine?.nodes.count(where: { $0.figure == .start }) == 2)
    }

    @Test
    func `a composite can be described and still be entered by its own name`() {
        let machine = Self.read("""
        stateDiagram-v2
        A --> run
        state "The run" as run {
          B --> C
        }
        """)

        #expect(machine?.composites.first?.title == "The run")
        #expect(machine?.transitions.first?.to == "run")
    }

    @Test(arguments: [
        "stateDiagram-v2\nA --> B\nnote right of A : the fence arrives",
        "stateDiagram-v2\nA --> B\nnote left of A\n  the fence arrives\nend note",
    ])
    func `a note is attached to the state it is written about`(source: String) {
        let machine = Self.read(source)

        #expect(machine?.nodes.count(where: { $0.figure == .note }) == 1)
        #expect(machine?.nodes.first { $0.figure == .note }?.label == "the fence arrives")
        // Attached: something joins the note to `A`, or it would float unplaced.
        let note = machine?.nodes.first { $0.figure == .note }?.name
        #expect(machine?.transitions.contains { $0.to == note && $0.from == "A" } == true)
    }

    @Test
    func `a direction line turns the machine`() {
        #expect(Self.read("stateDiagram-v2\ndirection LR\nA --> B")?.direction == .right)
        #expect(Self.read("stateDiagram-v2\nA --> B")?.direction == .down)
    }

    /// A STATED limitation, pinned. Mermaid scopes a direction to the composite it stands in;
    /// Argo lays one plan out on one axis, so a nested direction is read and ignored rather than
    /// turning the machine around it.
    @Test
    func `a direction inside a composite does not turn the whole machine`() {
        let machine = Self.read("""
        stateDiagram-v2
        [*] --> Working
        state Working {
          direction LR
          A --> B
        }
        """)

        #expect(machine?.direction == .down)
    }

    /// A figure with no room for words keeps none, which is what mermaid draws — the description
    /// would otherwise be set into a 26-point diamond and spill out of it.
    @Test
    func `a description does not go into a figure that carries no words`() {
        let machine = Self.read("stateDiagram-v2\nstate pick <<choice>>\nA --> pick\npick : decide")

        #expect(machine?.node(named: "pick")?.label.isEmpty == true)
        #expect(machine?.node(named: "pick")?.figure == .choice)
    }

    /// The degrade-down rule: anything this reader cannot read whole stays the fence it is today,
    /// never an error and never an empty box (#859).
    @Test(arguments: [
        "stateDiagram-v2",
        "stateDiagram-v2\nA --> B\nwhat is this line",
        "stateDiagram-v2\nstate Working {\n  A --> B",
        "stateDiagram-v2\nA --> B\n}",
        "stateDiagram-v2\nA -->",
        "stateDiagram-v2\nnote right of A : floating",
        "stateDiagram-v2\nA --> B\nnote left of A\n  half a note",
        // A composite holding nothing. Really written — `direction` inside one is the common way
        // to reach it — and the transitions naming it would otherwise resolve to no node, so the
        // arrow would vanish and its word would be drawn in the diagram's corner.
        "stateDiagram-v2\nA --> X\nstate X {\n  direction LR\n}",
        "stateDiagram-v2\nA --> X\nstate X {\n}",
        "erDiagram\nA ||--o{ B : has",
    ])
    func `a source this reader cannot read whole stays a fence`(source: String) {
        #expect(Self.read(source) == nil)
        #expect(MermaidDiagram.read(source)?.kind.isState != true)
    }

    @Test
    func `a state diagram is a diagram the block kind knows`() {
        #expect(MermaidDiagram.read("stateDiagram-v2\n[*] --> A")?.kind.isState == true)
        #expect(MermaidDiagram.read("stateDiagram\n[*] --> A")?.kind.isState == true)
    }
}

extension MermaidDiagram.Kind {
    /// Whether this is the state machine's own case. The tests' word, so a suite asserting the
    /// block kind does not have to spell a pattern match to do it.
    var isState: Bool {
        if case .state = self {
            return true
        }
        return false
    }
}
