@testable import MermaidLayout
import Testing

/// What an `erDiagram` source says, and what it does not.
///
/// Crow's foot spells a cardinality with the MAXIMUM against the entity and the minimum behind it,
/// and the two characters are mirrored between the ends — `}o` and `o{` are the same "zero or
/// more" read from either side. A reader that took them in written order would draw every
/// relationship the wrong way round (#865).
@Suite("Mermaid entity reading")
struct MermaidEntityReadingTests {
    static func read(_ source: String) -> MermaidCompartmented? {
        MermaidEntity.read(source)
    }

    static func ends(_ token: String) -> (MermaidTerminal, MermaidTerminal)? {
        guard let relation = read("erDiagram\nA \(token) B : has")?.relations.first else {
            return nil
        }
        return (relation.tail, relation.head)
    }

    @Test
    func `a relationship names both entities even where neither was declared`() {
        let diagram = Self.read("erDiagram\nCUSTOMER ||--o{ ORDER : places")

        #expect(diagram?.boxes.map(\.name) == ["CUSTOMER", "ORDER"])
        #expect(diagram?.relations.first?.label == "places")
    }

    /// Every zero/one/many combination, on both ends, by the pair that tells it from the others.
    @Test(arguments: [
        ("|o--o|", false, true),
        ("||--||", false, false),
        ("}o--o{", true, true),
        ("}|--|{", true, false),
    ])
    func `crows foot reads the same cardinality from either end`(
        token: String,
        isMany: Bool,
        isOptional: Bool,
    ) {
        let mark = MermaidTerminal.crowsFoot(isMany: isMany, isOptional: isOptional)

        #expect(Self.ends(token)?.0 == mark)
        #expect(Self.ends(token)?.1 == mark)
    }

    /// The two ends are read apart, not as one word.
    @Test
    func `each end carries its own cardinality`() {
        let ends = Self.ends("||--o{")

        #expect(ends?.0 == .crowsFoot(isMany: false, isOptional: false))
        #expect(ends?.1 == .crowsFoot(isMany: true, isOptional: true))
    }

    @Test(arguments: [("--", MermaidFigure.Line.solid), ("..", .dotted)])
    func `an identifying relationship is solid and a non-identifying one is dashed`(
        link: String,
        line: MermaidFigure.Line,
    ) {
        #expect(Self.read("erDiagram\nA ||\(link)|| B : has")?.relations.first?.line == line)
    }

    @Test
    func `an entity draws its attributes with their keys`() {
        let source = """
        erDiagram
        CUSTOMER {
          string name
          string number PK
          string sector "the trade it is in"
        }
        """

        #expect(Self.read(source)?.boxes.first?.compartments.lines == [
            "CUSTOMER", "string name", "string number PK", "string sector the trade it is in",
        ])
    }

    @Test
    func `an alias is drawn in the entity's place`() {
        // Mermaid's own page writes the space before the bracket.
        let source = "erDiagram\nCUSTOMER [\"Customer account\"] {\n  string name\n}"

        #expect(Self.read(source)?.boxes.first?.name == "CUSTOMER")
        #expect(Self.read(source)?.boxes.first?.compartments.head == ["Customer account"])
    }

    @Test(arguments: [
        "graph TD\nA --> B",
        "erDiagram",
        "erDiagram\nCUSTOMER {\n  string name",
        "erDiagram\nCUSTOMER {\n  name\n}",
        "erDiagram\nCUSTOMER ||--?{ ORDER : places",
        "erDiagram\nCUSTOMER one to many ORDER : places",
        "erDiagram\nCUSTOMER optionally to ORDER : places",
    ])
    func `a source this reader has no rule for stays a fence`(source: String) {
        #expect(Self.read(source) == nil)
    }

    @Test
    func `an entity diagram is one of the kinds the fence reader knows`() {
        #expect(MermaidDiagram.read("erDiagram\nCUSTOMER ||--o{ ORDER : places") != nil)
    }
}
