@testable import ArgoUI
import Foundation
import Testing

/// Reading a patch as code. Argo keeps no grammar of its own and no theme of its own — the
/// dependency does both — so the claim here is the one part Argo does own: which language a path
/// is, read from the name and never guessed from the contents.
@Suite("Evidence syntax")
struct EvidenceSyntaxTests {
    @Test
    func `a language is read from the extension and from nothing else`() {
        #expect(EvidenceLanguage(path: "Sources/ArgoUI/FeedCall.swift") == .swift)
        #expect(EvidenceLanguage(path: "apps/web/src/main.tsx") == .typescript)
        #expect(EvidenceLanguage(path: "cmd/argo/main.go") == .golang)
        #expect(EvidenceLanguage(path: "docs/adr/0022.md") == .markdown)
        #expect(EvidenceLanguage(path: "scripts/screenshot.sh") == .shell)
    }

    /// The alias is highlight.js's word, not Argo's. `golang` is named that way to clear the house
    /// identifier floor, and the grammar still has to be asked for by the name it answers to.
    @Test
    func `every language asks the grammar for itself by the name it answers to`() {
        #expect(EvidenceLanguage.golang.alias == "go")
        #expect(EvidenceLanguage.allCases.allSatisfy { !$0.alias.isEmpty })
    }

    /// A file Argo cannot name is drawn plain. Guessing from the contents would be Argo asserting
    /// a language the record never carried, and the honest answer costs nothing but colour.
    @Test
    func `an unknown or extensionless name has no language and takes the plain mark`() {
        #expect(EvidenceLanguage(path: "Makefile") == nil)
        #expect(EvidenceLanguage(path: "docs/notes.wat") == nil)
        #expect(EvidenceLanguage(path: "") == nil)
    }
}

/// Cutting a highlighted hunk back into the lines it was made of.
///
/// Its own suite because it is the part that can silently go wrong: a patch whose colours have
/// slipped one line against its gutter is still a plausible-looking patch, and the only defence is
/// that a count which does not match refuses to draw at all.
@Suite("Syntax line alignment")
struct SyntaxLineTests {
    @Test
    func `a run comes back as the lines it went in as`() throws {
        let code = ["let a = 1", "let b = 2"]
        let highlighted = AttributedString("let a = 1\nlet b = 2")

        let lines = try #require(SyntaxHighlight.aligned(highlighted, to: code))

        #expect(lines.map { String($0.characters) } == code)
    }

    /// The repair the whole thing exists for. The highlighter trims the indent off the first line
    /// it is handed, and the first line of a hunk is almost always indented — left alone, every
    /// patch in the panel would render with its opening line shoved to the margin.
    @Test
    func `the indent the highlighter ate is given back`() throws {
        let code = ["        return nil", "    }"]
        let highlighted = AttributedString("return nil\n    }")

        let lines = try #require(SyntaxHighlight.aligned(highlighted, to: code))

        #expect(lines.map { String($0.characters) } == code)
    }

    /// Blank lines at either end are trimmed away with the whitespace and have to be counted back,
    /// or every line after them is drawn against the wrong number.
    @Test
    func `blank lines either end are counted back`() throws {
        let code = ["", "let a = 1", "", ""]
        let highlighted = AttributedString("let a = 1")

        let lines = try #require(SyntaxHighlight.aligned(highlighted, to: code))

        #expect(lines.map { String($0.characters) } == code)
    }

    /// Colours drawn against the wrong numbers in the gutter is a worse patch than an uncoloured
    /// one, and it is the failure a reader would never notice.
    @Test
    func `a count that does not match refuses rather than guessing`() {
        let highlighted = AttributedString("let a = 1")

        #expect(SyntaxHighlight.aligned(highlighted, to: ["let a = 1", "let b = 2"]) == nil)
    }

    /// A hunk of nothing but blank lines has no grammar in it to read.
    @Test
    func `a hunk with nothing written in it is not highlighted at all`() {
        #expect(SyntaxHighlight.aligned(AttributedString(""), to: ["", "   "]) == nil)
    }

    /// The one test that actually runs the grammar. Everything else here is Argo's own arithmetic
    /// around a dependency; this is the claim that the dependency is wired to it at all — a theme
    /// it rejects, or an alias it does not know, fails silently as an uncoloured patch.
    @Test
    func `a real hunk comes back coloured, line for line`() async throws {
        let code = [
            "    /// Two edits of one file.",
            "    private var churn: some View {",
            "        Text(\"added\")",
            "    }",
        ]

        let lines = try #require(await SyntaxHighlight.lines(
            of: code,
            in: .swift,
            colors: SyntaxTheme.colors,
        ))

        #expect(lines.map { String($0.characters) } == code)
        // WHICH spans were coloured is highlight.js's business. That any of them were is Argo's.
        #expect(lines.contains { line in line.runs.contains { $0.foregroundColor != nil } })
    }

    /// A blank line inside a hunk is a line. Dropping it would shorten the run and take the whole
    /// patch's colours with it.
    @Test
    func `a blank line in the middle is still a line`() throws {
        let code = ["let a = 1", "", "let b = 2"]
        let highlighted = AttributedString("let a = 1\n\nlet b = 2")

        let lines = try #require(SyntaxHighlight.aligned(highlighted, to: code))

        #expect(lines.map { String($0.characters) } == code)
    }
}
