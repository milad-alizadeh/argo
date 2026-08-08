import ArgoEngine
@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// Which language a path is, read from the name and never guessed from the contents. Argo keeps no
/// grammar of its own and no theme of its own — the dependency does both — so this is the part Argo
/// actually owns.
@Suite("Evidence language")
struct EvidenceLanguageTests {
    @Test
    func `a language is read from the extension`() {
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
    func `a name carrying no extension Argo knows has no language`() {
        #expect(EvidenceLanguage(path: "Makefile") == nil)
        #expect(EvidenceLanguage(path: "docs/notes.wat") == nil)
        #expect(EvidenceLanguage(path: "") == nil)
    }

    /// No language means no language mark, and the panel falls back to the CALL's own — a command
    /// takes the terminal it ran in rather than the document that made it look like a file.
    @Test
    func `a subject with no language takes the mark of what the call was`() throws {
        #expect(try opened(.read, file: "Makefile").symbol == ArgoSymbol.read)
        #expect(opened(.execute, .command("bun run quality")).symbol == ArgoSymbol.ran)
    }

    /// The plain document survives for the one honest gap: a call whose kind Argo could not read,
    /// naming something it could not place either.
    @Test
    func `a call Argo could not classify takes the plain mark`() {
        #expect(opened(.unclassified, .plain("some_tool")).symbol == ArgoSymbol.plainSource)
    }

    /// A command's panel is identified by the command and how it went, so its header keeps the verb
    /// a file's header drops.
    @Test
    func `a command's panel says the verb a file's panel leaves to its mark`() throws {
        #expect(opened(.execute, .command("bun run quality")).saysVerb)
        #expect(try !opened(.edit, file: "a.swift").saysVerb)
    }

    private func opened(_ kind: FeedCall.Kind, file path: String) throws -> FeedEvidence {
        let file = try #require(FeedCall.FileName(path: path))
        return opened(kind, .file(file))
    }

    private func opened(_ kind: FeedCall.Kind, _ subject: FeedCall.Subject) -> FeedEvidence {
        FeedCall(
            kind: kind,
            subject: subject,
            churn: nil,
            ending: .succeeded,
            evidence: [.output(OutputEvidence(tier: .direct, text: "all:"))],
            repeats: 1,
        ).opened
    }
}

/// Cutting a highlighted hunk back into the lines it was made of, through the one entry a view
/// calls. Its own suite because it is the part that can silently go wrong: a patch whose colours
/// have slipped one line against its gutter is still a plausible-looking patch.
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

    /// The claim that the dependency is wired up at all: a theme it rejects, or an alias it does
    /// not know, fails silently as an uncoloured patch. WHICH spans were coloured is highlight.js's
    /// business; that any of them were is Argo's.
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

/// The AC: every colour the panel draws source in asserts its contrast against the surface it sits
/// on. The theme is the dependency's, so this cannot be checked by reading a palette file — the
/// grammar is run and every ink it actually produced is measured on the panel's own ground.
@Suite("Syntax legibility")
struct SyntaxContrastTests {
    /// 3:1 and not the 4.5:1 the contract's own text roles clear.
    ///
    /// Xcode's comment grey lands just under 4.5 on a near-black ground, and it is Apple's number
    /// for a reason: a comment is meant to recede from the code around it. Holding source to the
    /// prose floor would mean rejecting the editor's own theme — which the panel exists to match —
    /// so the floor here is the one for text a reader scans rather than reads word by word, and it
    /// is asserted rather than assumed.
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
    /// A rendered `Color` back in the contract's own components, so the same WCAG arithmetic the
    /// palette is held to can be pointed at a colour the palette never chose.
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
