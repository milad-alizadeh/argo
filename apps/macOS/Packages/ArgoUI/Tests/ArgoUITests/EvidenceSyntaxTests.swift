import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// Cutting a highlighted hunk back into the lines it was made of, through the one entry a view
/// calls. It goes wrong silently: a patch whose colours slipped one line against its gutter still
/// looks plausible.
@Suite("Syntax line alignment")
struct SyntaxLineTests {
    @Test
    func `a run comes back as the lines it went in as`() async throws {
        let code = ["let a = 1", "let b = 2"]

        #expect(try await highlighted(code) == code)
    }

    /// The repair the whole thing exists for. The highlighter trims the indent off the first line
    /// it is handed, and the first line of a hunk is almost always indented — left alone, every
    /// patch in the panel would render with its opening line shoved to the margin.
    @Test
    func `the indent the highlighter ate is given back`() async throws {
        let code = ["        return nil", "    }"]

        #expect(try await highlighted(code) == code)
    }

    /// Blank lines at either end are trimmed away with the whitespace and have to be counted back,
    /// or every line after them is drawn against the wrong number.
    @Test
    func `blank lines either end are counted back`() async throws {
        let code = ["", "let a = 1", "", ""]

        #expect(try await highlighted(code) == code)
    }

    /// A blank line inside a hunk is a line. Dropping it would shorten the run and take the whole
    /// patch's colours with it.
    @Test
    func `a blank line in the middle is still a line`() async throws {
        let code = ["let a = 1", "", "let b = 2"]

        #expect(try await highlighted(code) == code)
    }

    /// A hunk of nothing but blank lines has no grammar in it to read.
    @Test
    func `a hunk with nothing written in it is not highlighted at all`() async {
        #expect(await SyntaxHighlight.lines(
            of: ["", "   "],
            in: .swift,
            colors: SyntaxTheme.colors,
        ) == nil)
    }

    /// The dependency is wired up at all: a theme it rejects, or an alias it does not know, fails
    /// silently as an uncoloured patch.
    @Test
    func `a real hunk comes back coloured`() async throws {
        let lines = try #require(await SyntaxHighlight.lines(
            of: [
                "    /// Two edits of one file.",
                "    private var churn: some View {",
                "        Text(\"added\")",
                "    }",
            ],
            in: .swift,
            colors: SyntaxTheme.colors,
        ))

        #expect(lines.contains { line in line.runs.contains { $0.foregroundColor != nil } })
    }

    private func highlighted(_ code: [String]) async throws -> [String] {
        let lines = try #require(await SyntaxHighlight.lines(
            of: code,
            in: .swift,
            colors: SyntaxTheme.colors,
        ))
        return lines.map { String($0.characters) }
    }
}

/// Both sides of a patch, each read as its own program.
@Suite("Syntax across a patch")
struct SyntaxPatchTests {
    /// A hunk with both sides in it is not source in any language — the modified declaration
    /// appears twice. Handed to the grammar whole it colours plausibly and wrongly, and wrongly
    /// coloured code looks exactly like code, so each side is parsed as the file it belonged to.
    @Test
    func `every line of a patch is coloured, both sides of it`() async {
        let lines = await SyntaxPatch.lines(
            of: [
                DiffLine(side: .context, text: "func churn() -> Int {"),
                DiffLine(side: .del, text: "    let total = 1"),
                DiffLine(side: .add, text: "    let total = 2"),
                DiffLine(side: .context, text: "    return total"),
                DiffLine(side: .context, text: "}"),
            ],
            in: .swift,
            colors: SyntaxTheme.colors,
        )

        #expect(lines.count == 5)
        #expect(lines.allSatisfy { $0 != nil })
    }

    /// A hunk of pure context is ONE program. Parsing it twice would be the same answer twice.
    @Test
    func `a patch that changed nothing keeps every line`() async {
        let lines = await SyntaxPatch.lines(
            of: [DiffLine(side: .context, text: "let a = 1")],
            in: .swift,
            colors: SyntaxTheme.colors,
        )

        #expect(lines.count == 1)
        #expect(lines[0] != nil)
    }
}

/// Every colour the panel draws source in asserts its contrast against the surface it sits on. The
/// theme is the dependency's, so the grammar is run and every ink it produced is measured rather
/// than a palette file being read.
@Suite("Syntax legibility")
struct SyntaxContrastTests {
    /// 3:1 and not the 4.5:1 the contract's own text roles clear: Xcode's comment grey lands just
    /// under 4.5 on a near-black ground, so the prose floor would reject the editor's own theme.
    static let floor = 3.0

    @Test
    func `every ink the grammar draws clears the floor on the panel's ground`() async throws {
        let ground = ArgoPalette.graphite.surface.sunken
        let lines = try #require(await SyntaxHighlight.lines(
            of: SyntaxContrastTests.sample,
            in: .swift,
            colors: SyntaxTheme.colors,
        ))

        let inks = lines.flatMap { line in line.runs.compactMap(\.foregroundColor) }
        #expect(!inks.isEmpty)
        for ink in Set(inks) {
            #expect(ArgoColor(ink).contrastRatio(on: ground) >= SyntaxContrastTests.floor)
        }
    }

    /// Enough Swift to make the theme produce every ink it has: a comment, a keyword, a type, a
    /// string, a number, a property name.
    static let sample = [
        "/// The patch's lines, coloured.",
        "public struct Hunk: Sendable {",
        "    let start: Int = 42",
        "    let name: String = \"evidence\"",
        "    @State private var open = false",
        "    func read() throws -> [String] { [name] }",
        "}",
    ]
}

private extension ArgoColor {
    /// A rendered `Color` back in the contract's own components, so the palette's WCAG arithmetic
    /// can be pointed at a colour the palette never chose.
    init(_ color: Color) {
        let resolved = color.resolve(in: EnvironmentValues())
        self.init(
            red: Double(resolved.red),
            green: Double(resolved.green),
            blue: Double(resolved.blue),
            opacity: Double(resolved.opacity),
        )
    }
}
