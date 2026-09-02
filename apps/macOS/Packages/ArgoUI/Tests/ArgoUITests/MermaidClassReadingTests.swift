@testable import ArgoUI
import Testing

/// What a `classDiagram` source says, and what it does not.
///
/// The claim the ticket rests on is about the ENDS: mermaid spells which end a marker stands at
/// into the token itself, so `Animal <|-- Duck` and `Duck --|> Animal` are the same relationship
/// written twice. A reader that dropped the side would draw the child as the parent (#865).
@Suite("Mermaid class reading")
struct MermaidClassReadingTests {
    static func read(_ source: String) -> MermaidCompartmented? {
        MermaidClass.read(source)
    }

    /// Every line of every box, in the order the boxes were named.
    static func words(_ source: String) -> [[String]] {
        read(source)?.boxes.map(\.compartments.lines) ?? []
    }

    @Test
    func `a relationship names both classes even where neither was declared`() {
        let diagram = Self.read("classDiagram\nAnimal <|-- Duck")

        #expect(diagram?.boxes.map(\.name) == ["Animal", "Duck"])
        #expect(diagram?.relations.count == 1)
    }

    /// The marker stands where the token put it, and the same relationship written the other way
    /// round names the same two ends.
    @Test
    func `inheritance points at the parent whichever way the token was written`() {
        let left = Self.read("classDiagram\nAnimal <|-- Duck")?.relations.first
        let right = Self.read("classDiagram\nDuck --|> Animal")?.relations.first

        #expect(left?.from == "Animal")
        #expect(left?.tail == .triangle)
        #expect(left?.head == MermaidTerminal.none)
        #expect(right?.to == "Animal")
        #expect(right?.head == .triangle)
        #expect(right?.tail == MermaidTerminal.none)
    }

    /// The six forms, each by the pair that tells it from the others. A filled diamond the wrong
    /// way round says the opposite of what the author meant, so every one is pinned.
    @Test(arguments: [
        ("Whole *-- Part", MermaidTerminal.diamond(isSolid: true), MermaidFigure.Line.solid),
        ("Whole o-- Part", .diamond(isSolid: false), .solid),
        ("Parent <|-- Child", .triangle, .solid),
        ("Interface <|.. Type", .triangle, .dotted),
    ])
    func `a relationship's own form is its marker and its stroke`(
        line: String,
        mark: MermaidTerminal,
        stroke: MermaidFigure.Line,
    ) {
        let relation = Self.read("classDiagram\n\(line)")?.relations.first

        #expect(relation?.tail == mark)
        #expect(relation?.line == stroke)
    }

    @Test(arguments: [
        ("User --> Order", MermaidTerminal.arrow, MermaidFigure.Line.solid),
        ("User ..> Order", .arrow, .dotted),
        ("User -- Order", MermaidTerminal.none, .solid),
        ("User .. Order", MermaidTerminal.none, .dotted),
    ])
    func `an association and a dependency differ only in the stroke`(
        line: String,
        mark: MermaidTerminal,
        stroke: MermaidFigure.Line,
    ) {
        let relation = Self.read("classDiagram\n\(line)")?.relations.first

        #expect(relation?.head == mark)
        #expect(relation?.line == stroke)
    }

    @Test
    func `a two-way relationship carries a marker at each end`() {
        let relation = Self.read("classDiagram\nA <|--|> B")?.relations.first

        #expect(relation?.tail == .triangle)
        #expect(relation?.head == .triangle)
    }

    /// A cardinality belongs to the end it was written beside, and the word after the `:` belongs
    /// to the line itself.
    @Test
    func `cardinality is read onto the end it was written beside`() {
        let relation = Self.read("classDiagram\nUser \"1\" --> \"0..*\" Order : places")?
            .relations.first

        #expect(relation?.tailWord == "1")
        #expect(relation?.headWord == "0..*")
        #expect(relation?.label == "places")
    }

    @Test
    func `a class block splits its attributes from its methods`() {
        let source = """
        classDiagram
        class Session {
          +String id
          -Date started
          +resume() Session
        }
        """

        #expect(Self.words(source) == [[
            "Session",
            "+String id",
            "-Date started",
            "+resume() Session",
        ]])
        #expect(Self.read(source)?.boxes.first?.compartments.bands.count == 2)
    }

    /// The colon spelling names one member at a time, and it may come before or after the block
    /// that declares the class.
    @Test
    func `the colon spelling adds a member to a class named anywhere`() {
        let source = "classDiagram\nSession : +String id\nSession : +resume()"

        #expect(Self.words(source) == [["Session", "+String id", "+resume()"]])
    }

    /// `<<interface>>` stands above the name, set the way mermaid sets it.
    @Test(arguments: [
        "classDiagram\nclass Shape {\n<<interface>>\n+draw()\n}",
        "classDiagram\n<<interface>> Shape\nShape : +draw()",
    ])
    func `an annotation stands above the name it qualifies`(source: String) {
        #expect(Self.words(source) == [["«interface»", "Shape", "+draw()"]])
    }

    /// A generic is written in tildes and drawn in angle brackets, in a class's name and in a
    /// member alike.
    @Test
    func `a generic type is drawn in angle brackets`() {
        let source = "classDiagram\nclass Store~Item~\nStore : +List~Item~ held"

        #expect(Self.words(source) == [["Store<Item>", "+List<Item> held"]])
    }

    /// Mermaid documents `List~List~int~~`, and a reader that cut the tildes into pairs drew the
    /// inner one as `<>` — bad output where every other unreadable spelling here gets a fence.
    @Test
    func `a generic nests`() {
        #expect(Self.words("classDiagram\nStore : +List~List~int~~ rows")
            == [["Store", "+List<List<int>> rows"]])
    }

    /// The `~` that means package visibility opens no generic: it stands at the head of the member
    /// with no type name in front of it.
    @Test
    func `a package visibility marker is not a generic`() {
        #expect(Self.words("classDiagram\nSession : ~Project owner")
            == [["Session", "~Project owner"]])
    }

    /// A generic stated on a RELATIONSHIP line reaches the box, as an entity's alias does. Nothing
    /// says a class must be declared before it is related.
    @Test
    func `a generic named only by a relationship still draws`() {
        #expect(Self.words("classDiagram\nStore~Item~ --> Session")
            == [["Store<Item>"], ["Session"]])
    }

    @Test(arguments: [
        "graph TD\nA --> B",
        "classDiagram",
        "classDiagram\nclass Session {\n+String id",
        "classDiagram\nclick Session href \"x\"",
        "classDiagram\nnote \"a note about nothing\"",
        "classDiagram\nlink Shape \"https://example.com\"",
        "classDiagram\ncallback Shape \"handler\"",
        "classDiagram\ncssClass \"Shape\" someclass",
        "classDiagram\nnamespace Reading {",
        "classDiagram\nstyle Shape fill:#f9f",
        "classDiagram\nclassDef someclass fill:#f96",
        "classDiagram\nStore~Item --> Session",
        "classDiagram\nSession",
    ])
    func `a source this reader has no rule for stays a fence`(source: String) {
        #expect(Self.read(source) == nil)
    }

    @Test
    func `a direction turns the whole diagram`() {
        #expect(Self.read("classDiagram\ndirection LR\nA --> B")?.direction == .right)
    }

    /// The diagram reader reaches it, which is what makes the fence draw rather than stay source.
    @Test
    func `a class diagram is one of the kinds the fence reader knows`() {
        #expect(MermaidDiagram.read("classDiagram\nAnimal <|-- Duck") != nil)
    }
}
