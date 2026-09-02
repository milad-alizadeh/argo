@testable import MermaidLayout
import Testing

/// What a `pie` fence is read as, and — the half that matters more — what it is NOT read as.
/// Anything this reader cannot draw returns nothing, which leaves the block the fence it is today.
@Suite("Mermaid pie reading")
struct MermaidPieReadingTests {
    private static func read(_ body: String) -> MermaidPie? {
        MermaidPie.read("pie\n" + body)
    }

    @Test
    func `a header and its rows are a pie chart`() {
        let pie = Self.read("\"Read\" : 3\n\"Write\" : 1")

        #expect(pie?.slices == [.init(label: "Read", value: 3), .init(label: "Write", value: 1)])
    }

    /// Each reader owns its own keyword, so the order `MermaidDiagram` asks them in settles
    /// nothing.
    @Test(arguments: [
        "graph TD\nA --> B",
        "sequenceDiagram\nA->>B: hi",
        "pie",
        "piechart\n\"Read\" : 3",
        "",
    ])
    func `a source this reader does not own is refused`(source: String) {
        #expect(MermaidPie.read(source) == nil)
    }

    /// A line with no rule leaves the whole block a fence rather than a chart missing a slice —
    /// half a diagram drawn confidently is worse than the source.
    @Test(arguments: [
        "\"Read\" : 3\nwhat is this",
        "\"Read\" : three",
        "\"Read\" : -3",
        "Read : 3",
        "\"Read\" 3",
        "\"Read\" : 3 : 4",
    ])
    func `a line this reader has no rule for refuses the whole chart`(body: String) {
        #expect(Self.read(body) == nil)
    }

    @Test
    func `the title is read from its own line`() {
        #expect(Self.read("title Where the time went\n\"Read\" : 3")?.title
            == "Where the time went")
    }

    /// Mermaid writes both on the header, in either combination, so all four spellings reach the
    /// same chart.
    @Test(arguments: [
        ("pie", "", false),
        ("pie showData", "", true),
        ("pie title Votes", "Votes", false),
        ("pie showData title Votes", "Votes", true),
        // Mermaid's own keywords are case-insensitive, and this reader says so — so every
        // spelling an agent really writes reaches the same chart.
        ("PIE", "", false),
        ("pie ShowData TITLE Votes", "Votes", true),
    ])
    func `the header carries showData and a title of its own`(
        header: String,
        title: String,
        showsData: Bool,
    ) {
        let pie = MermaidPie.read(header + "\n\"Read\" : 3")

        #expect(pie?.title == title)
        #expect(pie?.showsData == showsData)
    }

    @Test
    func `a title on its own line is read whatever case its keyword is in`() {
        #expect(Self.read("Title Where the time went\n\"Read\" : 3")?.title
            == "Where the time went")
    }

    /// A legend is READ. Scientific notation is a number nobody wrote, and trailing zeros are a
    /// precision the source did not claim.
    @Test(arguments: [
        ("1234567", "1234567 · 100%"),
        ("42.96", "42.96 · 100%"),
        ("3", "3 · 100%"),
        ("0.5", "0.5 · 100%"),
    ])
    func `a value is written back the way it was written`(value: String, reading: String) {
        #expect(MermaidPie.read("pie showData\n\"Read\" : " + value)?.readings == [reading])
    }

    /// The order is the order they were written, because that is the order they are drawn in.
    @Test
    func `slices keep the order the source wrote them in`() {
        #expect(Self.read("\"C\" : 1\n\"A\" : 2\n\"B\" : 3")?.slices.map(\.label) == [
            "C",
            "A",
            "B",
        ])
    }

    /// A quoted label is quoted precisely so it can carry what would otherwise read as syntax.
    @Test
    func `a label carries the punctuation its quotes protect`() {
        #expect(Self.read("\"Read: the body\" : 3")?.slices.first?.label == "Read: the body")
    }

    /// Shares are computed from the values, which mermaid never asked to sum to a hundred.
    @Test
    func `shares are the values normalised, whatever they sum to`() {
        let pie = Self.read("\"Read\" : 30\n\"Write\" : 10")

        #expect(pie?.shares == [0.75, 0.25])
    }

    /// Nothing to divide by is a chart with no wedges, not a crash and not eight equal ones
    /// invented to fill the circle.
    @Test
    func `a chart whose values are all zero shares nothing`() {
        #expect(Self.read("\"Read\" : 0\n\"Write\" : 0")?.shares == [0, 0])
    }

    @Test
    func `one slice is the whole circle`() {
        #expect(Self.read("\"Read\" : 7")?.shares == [1])
    }

    /// `MermaidDiagram` is where a fence becomes a block kind, so the pie has to arrive through it.
    @Test
    func `a pie fence reaches the diagram as its own kind`() {
        let diagram = MermaidDiagram.read("pie\n\"Read\" : 3")

        #expect(diagram?.kind == .pie(MermaidPie(slices: [.init(label: "Read", value: 3)])))
    }
}
