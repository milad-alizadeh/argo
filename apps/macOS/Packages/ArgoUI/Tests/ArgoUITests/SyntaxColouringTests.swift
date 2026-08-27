import ArgoEngine
@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// The rule three surfaces used to keep as a comment each: colours are drawn over the characters
/// they were read from, and over no others.
///
/// It goes wrong silently and it went wrong twice. A stack recycles a row view by its offset, so
/// the row that drew one file's line 4 draws the next file's line 4 with the first one's colours
/// still in hand — and wrongly coloured code looks exactly like code.
@Suite("Syntax colouring identity")
struct SyntaxColouringIdentityTests {
    /// Two files at the same offsets, same grammar, same line count — everything a request could
    /// have been keyed on except the characters. Neither may see the other's colours.
    @Test
    func `one file's colours are never handed to another file's words`() async {
        let mine = SyntaxRequest.source(lines: ["let a = 1", "let b = 2"], under: .swift)
        let theirs = SyntaxRequest.source(lines: ["let c = 3", "let d = 4"], under: .swift)

        let colouring = await SyntaxColouring(of: mine)

        #expect(colouring.over(mine)[0] != nil)
        #expect(colouring.over(theirs)[0] == nil)
        #expect(colouring.over(theirs)[1] == nil)
    }

    /// The same characters read at a different offset are the same request. Colours that went away
    /// when a row scrolled would flicker the whole panel.
    @Test
    func `the same characters keep their colours wherever they are drawn`() async {
        let request = SyntaxRequest.source(lines: ["    return nil", "}"], under: .swift)

        let colouring = await SyntaxColouring(of: request)

        #expect(colouring.over(request)[0] != nil)
        #expect(colouring.over(SyntaxRequest.source(
            lines: ["    return nil", "}"],
            under: .swift,
        ))[0] != nil)
    }

    /// One grammar's reading of a text is not another's, so the language is in the request too.
    @Test
    func `the same characters under a second grammar are a second request`() async {
        let swift = SyntaxRequest.source(lines: ["let a = 1"], under: .swift)
        let ruby = SyntaxRequest.source(lines: ["let a = 1"], under: .ruby)

        #expect(await SyntaxColouring(of: swift).over(ruby)[0] == nil)
    }

    /// A patch is the surface the slip was found on: two hunks agreeing on language, start line and
    /// line count, differing only in what they changed.
    @Test
    func `two hunks of one file do not share a reading`() async {
        let first = SyntaxRequest.patch(lines: [
            DiffLine(side: .del, text: "    let total = 1"),
            DiffLine(side: .add, text: "    let total = 2"),
        ], under: .swift)
        let second = SyntaxRequest.patch(lines: [
            DiffLine(side: .del, text: "    let count = 8"),
            DiffLine(side: .add, text: "    let count = 9"),
        ], under: .swift)

        let colouring = await SyntaxColouring(of: first)

        #expect(colouring.over(first)[1] != nil)
        #expect(colouring.over(second)[1] == nil)
    }
}

/// What a surface gets while the grammar has not answered, and where it cannot. Every one of these
/// draws the characters as they arrived: a surface showing a record owes the reader the bytes.
@Suite("Syntax colouring fallback")
struct SyntaxColouringFallbackTests {
    @Test
    func `nothing is coloured before the grammar answers`() {
        let request = SyntaxRequest.source(lines: ["let a = 1"], under: .swift)

        #expect(SyntaxColouring.plain.over(request)[0] == nil)
        #expect(SyntaxColouring.plain.whole == nil)
    }

    /// The read is guarded, not trusted: the run is a request behind the characters for as long as
    /// the grammar takes, and a row past its end must draw plain rather than trap.
    @Test
    func `a line past the end of the run is plain, not a crash`() async {
        let request = SyntaxRequest.source(lines: ["let a = 1"], under: .swift)

        let colouring = await SyntaxColouring(of: request).over(request)

        #expect(colouring[0] != nil)
        #expect(colouring[1] == nil)
        #expect(colouring[-1] == nil)
    }

    /// A path whose extension Argo does not know, and a fence naming a grammar it cannot read. The
    /// answer is no colours, never a guessed grammar.
    @Test
    func `a request with no grammar is drawn plain`() async {
        let patch = SyntaxRequest.patch(
            lines: [DiffLine(side: .context, text: "let a = 1")],
            under: nil,
        )
        let block = SyntaxRequest.block("let a = 1", under: nil)

        #expect(await SyntaxColouring(of: patch).over(patch)[0] == nil)
        #expect(await SyntaxColouring(of: block).over(block).whole == nil)
    }
}

/// A fenced block is drawn in one `Text`, so its lines are joined back after the grammar has read
/// them a line at a time.
@Suite("Syntax colouring of a whole block")
struct SyntaxColouringBlockTests {
    @Test
    func `a block comes back as one run, its newlines kept`() async throws {
        let code = "struct Hunk {\n    let start: Int\n}"
        let request = SyntaxRequest.block(code, under: .swift)

        let whole = try #require(await SyntaxColouring(of: request).over(request).whole)

        #expect(String(whole.characters) == code)
        #expect(whole.runs.contains { $0.foregroundColor != nil })
    }
}
