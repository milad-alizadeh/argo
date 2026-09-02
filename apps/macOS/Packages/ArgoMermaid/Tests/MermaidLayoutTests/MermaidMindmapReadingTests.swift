@testable import MermaidLayout
import Testing

/// A mindmap's source, read. The one mermaid type whose structure is the WHITESPACE, so the claims
/// here are about indent depth rather than about the line patterns every other reader matches.
///
/// The refusals are the half that matters. A source not fully understood returns nothing, which is
/// what leaves the block the fence it is today rather than an error or an empty box.
@Suite("Mermaid mindmap reading")
struct MermaidMindmapReadingTests {
    private static func read(_ source: String) -> MermaidMindmap? {
        MermaidMindmap.read(source)
    }

    private static func texts(under source: String) -> [String]? {
        read(source)?.root.children.map(\.text)
    }

    @Test
    func `the first line under the header is the root`() {
        let map = Self.read("mindmap\n  Argo")

        #expect(map?.root.text == "Argo")
        #expect(map?.root.children.isEmpty == true)
    }

    @Test
    func `a deeper line is a child of the line above it`() {
        #expect(Self.texts(under: "mindmap\n  Argo\n    Reader\n    Layout") == [
            "Reader",
            "Layout",
        ])
    }

    /// The whole reason this reader counts columns rather than dividing by a width: a source
    /// indented two, then three, then five is nested three deep, and every one of those widths is
    /// somebody's editor.
    @Test
    func `an irregular indent nests by the column alone`() {
        let map = Self.read("mindmap\nArgo\n  Reader\n     Scan\n          Cursor")

        #expect(map?.root.children.first?.text == "Reader")
        #expect(map?.root.children.first?.children.first?.text == "Scan")
        #expect(map?.root.children.first?.children.first?.children.first?.text == "Cursor")
    }

    /// A line back out to a column an ancestor stands at is that ancestor's SIBLING, however many
    /// levels it comes back through.
    @Test
    func `a shallower line closes every branch deeper than it`() {
        let map = Self.read("mindmap\nArgo\n  Reader\n    Scan\n      Cursor\n  Layout")

        #expect(map?.root.children.map(\.text) == ["Reader", "Layout"])
        #expect(map?.root.children.last?.children.isEmpty == true)
    }

    @Test(arguments: [
        ("a[square]", MermaidOutline.rect),
        ("a(rounded)", .rounded),
        ("a((circle))", .ellipse),
        ("a))bang((", .bang),
        ("a)cloud(", .cloud),
        ("a{{hexagon}}", .hexagon),
    ])
    func `a node takes the figure its brackets name`(spelled: String, outline: MermaidOutline) {
        #expect(Self.read("mindmap\n\(spelled)")?.root.outline == outline)
    }

    /// A mindmap's text is prose and not an identifier: spaces, punctuation and all, which is why
    /// the flowchart's own node reading cannot be pointed at one of these lines.
    @Test
    func `a bare line is its own text, spaces and all`() {
        #expect(Self.read("mindmap\n  British popular psychology")?.root.text
            == "British popular psychology")
    }

    @Test(arguments: ["<br/>", "<br>", "<br />"])
    func `a break in the text is a line of its own`(spelled: String) {
        #expect(Self.read("mindmap\n  On effectiveness\(spelled)and features")?.root.text
            == "On effectiveness\nand features")
    }

    /// `:::class` and `::icon()` say something ABOUT the node above them rather than adding one.
    /// Read as nodes they would nest a phantom child under every annotated branch.
    @Test
    func `an annotation is not a child of the node it annotates`() {
        let map = Self.read("mindmap\nArgo\n  Origins\n    ::icon(fa fa-book)\n    :::urgent")

        #expect(map?.root.children.map(\.text) == ["Origins"])
        #expect(map?.root.children.first?.children.isEmpty == true)
    }

    /// Argo has no user stylesheet, so what a class NAMES is dropped and only the fact of it kept:
    /// the source called this node out, and the diagram says so.
    @Test
    func `a classed node is called out`() {
        let map = Self.read("mindmap\nArgo\n  Origins\n  :::urgent")

        #expect(map?.root.children.first?.isCalledOut == true)
        #expect(map?.root.isCalledOut == false)
    }

    /// Brackets that close mid-line are PROSE. Read as a figure they leave a remainder, and
    /// refusing on that would lose the whole map over one parenthesis somebody wrote in a branch.
    @Test(arguments: [
        "Argo(beta) ships",
        "Reading (mostly) works",
        "a[one] and b[two]",
    ])
    func `a bracket pair inside prose is text rather than a figure`(line: String) {
        let node = Self.read("mindmap\n  \(line)")?.root

        #expect(node?.text == line)
        #expect(node?.outline == .rounded)
    }

    /// Indented with tabs ALONE it nests like anything else — what has no answer is a tab beside a
    /// space, and only that is refused.
    @Test
    func `a source indented with tabs alone still nests`() {
        #expect(Self.texts(under: "mindmap\n\tArgo\n\t\tReader") == ["Reader"])
    }

    @Test
    func `the deepest node is reachable however deep it stands`() {
        let source = "mindmap\nA\n  B\n    C\n      D\n        E"
        var node = Self.read(source)?.root

        for expected in ["A", "B", "C", "D", "E"] {
            #expect(node?.text == expected)
            node = node?.children.first
        }
    }

    @Test(arguments: [
        "graph TD\nA --> B",
        "mindmap",
        "  Argo\n    Reader",
        // Two nodes at the root's own column are two roots, which mermaid refuses as well.
        "mindmap\nArgo\nCodex",
        // An opener with no closer: a fence still streaming in looks exactly like this.
        "mindmap\n  Argo\n    Reader[the scan",
        // Tabs beside spaces: a tab is as wide as the editor says, so the nesting has no one
        // answer and the map degrades to its fence rather than to a wrong shape.
        "mindmap\n\troot\n  A",
    ])
    func `a source this reader cannot read draws nothing`(source: String) {
        #expect(Self.read(source) == nil)
    }
}
