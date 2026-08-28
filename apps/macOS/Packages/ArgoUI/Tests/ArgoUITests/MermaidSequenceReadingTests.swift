@testable import ArgoUI
import Testing

/// What a `sequenceDiagram` fence is read as, and — the half that matters more — what it is NOT
/// read as. Anything this reader cannot draw returns nothing, which leaves the block the fence it
/// is today.
@Suite("Mermaid sequence reading")
struct MermaidSequenceReadingTests {
    private static func read(_ body: String) -> MermaidSequence? {
        MermaidSequence.read("sequenceDiagram\n" + body)
    }

    @Test
    func `a header and its arrows are a sequence diagram`() {
        let diagram = Self.read("A->>B: Hello\nB-->>A: Hi")

        #expect(diagram?.names == ["A", "B"])
        #expect(diagram?.messages.map(\.text) == ["Hello", "Hi"])
    }

    /// The flowchart's header is not this one's, and the other way about — each reader owns its own
    /// keyword, so the order `MermaidDiagram` asks them in settles nothing.
    @Test(arguments: ["graph TD\nA --> B", "sequenceDiagram", "", "pie title Votes"])
    func `a source this reader does not own is refused`(source: String) {
        #expect(MermaidSequence.read(source) == nil)
    }

    @Test
    func `a participant is declared with the label its box says`() {
        let diagram = Self.read("participant A as Alice\nA->>A: think")

        #expect(diagram?.participants == [.init(name: "A", label: "Alice")])
    }

    @Test
    func `an actor is a participant drawn as its own figure`() {
        #expect(Self.read("actor Ada\nAda->>Ada: think")?.participants.first?.isActor == true)
    }

    /// The order is the order the source first MET a name, declared or not — so a diagram read
    /// twice lays out twice the same.
    @Test
    func `an implicit participant takes its place in first-use order`() {
        #expect(Self.read("C->>A: one\nA->>B: two")?.names == ["C", "A", "B"])
    }

    /// A declaration after the fact says more about a name; it does not move it.
    @Test
    func `a late declaration keeps the place first use gave it`() {
        let diagram = Self.read("C->>A: one\nparticipant A as Alice")

        #expect(diagram?.names == ["C", "A"])
        #expect(diagram?.participants.last?.label == "Alice")
    }

    @Test(arguments: [
        ("->", MermaidSequence.Stroke.solid, MermaidSequence.Head.none),
        ("-->", .dotted, .none),
        ("->>", .solid, .filled),
        ("-->>", .dotted, .filled),
        ("-x", .solid, .cross),
        ("--x", .dotted, .cross),
        ("-)", .solid, .open),
        ("--)", .dotted, .open),
    ])
    func `each arrow names the line and the mark it is drawn with`(
        token: String,
        stroke: MermaidSequence.Stroke,
        head: MermaidSequence.Head,
    ) {
        let message = Self.read("A\(token)B: word")?.messages.first

        #expect(message?.stroke == stroke)
        #expect(message?.head == head)
    }

    /// Mermaid's bidirectional arrow is one line saying two things. It degrades to its source
    /// rather than to an arrow pointing the wrong way.
    @Test(arguments: ["A<<->>B: both", "A=>B: what", "A->B->C: chain"])
    func `an arrow this reader does not draw refuses the source`(line: String) {
        #expect(Self.read(line) == nil)
    }

    @Test
    func `the plus and minus shorthand activate and deactivate`() {
        let diagram = Self.read("A->>+B: call\nB-->>-A: reply")

        #expect(diagram?.messages.map(\.activates) == [true, false])
        #expect(diagram?.messages.map(\.deactivates) == [false, true])
    }

    @Test
    func `activate and deactivate are read in their own right`() {
        #expect(Self.read("A->>B: go\nactivate B\ndeactivate B")?.events.suffix(2) == [
            .activate("B"), .deactivate("B"),
        ])
    }

    @Test(arguments: [
        ("Note left of A: aside", MermaidSequence.Note.Placement.left, ["A"]),
        ("Note right of A: aside", .right, ["A"]),
        ("note over A: aside", .over, ["A"]),
        ("Note over A,B: aside", .over, ["A", "B"]),
    ])
    func `a note names where it stands and who it stands by`(
        line: String,
        placement: MermaidSequence.Note.Placement,
        over: [String],
    ) {
        let diagram = Self.read("A->>B: go\n\(line)")

        #expect(diagram?.notes == [.init(placement: placement, over: over, text: "aside")])
    }

    /// `left of` stands beside exactly one lifeline, and a note with nothing to say is not one.
    @Test(arguments: ["Note left of A,B: aside", "Note over A: ", "Note beside A: aside"])
    func `a note this reader cannot place refuses the source`(line: String) {
        #expect(Self.read("A->>B: go\n\(line)") == nil)
    }

    @Test(arguments: ["loop", "alt", "opt", "par", "critical"])
    func `each block keyword opens a frame`(keyword: String) throws {
        let diagram = Self.read("\(keyword) every minute\nA->>B: ping\nend")

        #expect(try diagram?.events.first == .opens(
            #require(.init(rawValue: keyword)),
            "every minute",
        ))
        #expect(diagram?.events.last == .closes)
    }

    @Test(arguments: ["else failed", "and in parallel", "option retry"])
    func `each divider divides the block it is in`(line: String) {
        let diagram = Self.read("alt ok\nA->>B: one\n\(line)\nA->>B: two\nend")

        #expect(diagram?.events.contains { $0 == .divides(String(line.split(separator: " ")
                .dropFirst().joined(separator: " ")))
        } == true)
    }

    /// An unbalanced source is half a diagram. A divider or an `end` with nothing open is the same
    /// mistake read from the other side.
    @Test(arguments: [
        "loop forever\nA->>B: ping",
        "A->>B: ping\nend",
        "A->>B: ping\nelse failed",
    ])
    func `an unbalanced block refuses the source`(body: String) {
        #expect(Self.read(body) == nil)
    }

    /// The keyword and not merely its letters: reading `endpoint` as `end` would close a block
    /// nobody opened.
    @Test
    func `a name that starts with a keyword is still a name`() {
        #expect(Self.read("endpoint->>participants: go")?.names == ["endpoint", "participants"])
    }

    @Test
    func `a comment says nothing about the diagram`() {
        #expect(Self.read("%% a note to the author\nA->>B: go")?.names == ["A", "B"])
    }

    /// The pairing the view rests on: one label per caption, participants first, then messages,
    /// then notes, then the frames' own words.
    @Test
    @MainActor func `the labels are the participants, the messages, the notes and the frames`() {
        let diagram = Self.read("""
        loop twice
        A->>B: go
        Note over A: waiting
        end
        """)

        #expect(diagram?.labels.map(\.text) == ["A", "B", "go", "waiting", "loop [twice]"])
    }

    /// A `mermaid` fence declaring this grammar becomes a diagram block, which is the whole point
    /// of reading it at the parse layer.
    @Test
    func `a sequence source reads as a diagram`() {
        #expect(MermaidDiagram.read("sequenceDiagram\nA->>B: go") != nil)
    }
}
