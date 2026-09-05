@testable import ArgoUI
import Foundation
@testable import MermaidLayout
import Testing

/// The shape an agent gave its answer, found in the characters it wrote. Nothing here rewrites a
/// word: every claim is that a marker was recognised and taken off, or that it was left alone.
@Suite("Markdown blocks")
struct MarkdownBlockTests {
    @Test
    func `a heading is a heading, and its level is the agent's own outline`() {
        #expect(MarkdownBlock.blocks(in: "## What I found") == [
            .heading(level: 2, text: "What I found"),
        ])
    }

    /// The space after the hashes is what makes it a heading. `#421` is a ticket number, and a feed
    /// that drew it at title size would be reading punctuation as structure.
    @Test
    func `a hash with no space after it is prose`() {
        #expect(MarkdownBlock.blocks(in: "#421 is the ticket") == [
            .paragraph("#421 is the ticket"),
        ])
    }

    @Test
    func `a list item keeps its words and loses its marker`() {
        #expect(MarkdownBlock.blocks(in: "- one\n* two") == [.bullet("one"), .bullet("two")])
    }

    /// A list starting at 3 is a list starting at 3 — the host's own numbering, not a renderer's.
    @Test
    func `a numbered item keeps the number the agent wrote`() {
        #expect(MarkdownBlock.blocks(in: "3. third") == [.numbered(marker: "3.", text: "third")])
    }

    @Test
    func `a fenced block is verbatim, and its language is what the agent declared`() {
        let text = "```swift\nlet a = 1\n\nlet b = 2\n```"

        #expect(MarkdownBlock.blocks(in: text) == [
            .fenced(code: "let a = 1\n\nlet b = 2", info: "swift"),
        ])
    }

    /// A turn that ended mid-block still wrote those characters. Dropping them because no closing
    /// fence arrived would lose the newest thing the agent said.
    @Test
    func `an unterminated fence still closes, keeping what was inside it`() {
        #expect(MarkdownBlock.blocks(in: "```\nhalf a thought") == [
            .fenced(code: "half a thought", info: nil),
        ])
    }

    /// The detection is a PARSE and not a rendering decision, so the renderer and the overview lane
    /// read one answer about what the block is.
    @Test
    func `a mermaid fence Argo can read is a diagram`() {
        let chart = MermaidFlowchart(
            direction: .down,
            nodes: [.init(name: "A", label: "A"), .init(name: "B", label: "B")],
            edges: [.init(from: "A", to: "B")],
            groups: [],
        )
        let expected: [MarkdownBlock] = [
            .diagram(MermaidDiagram(source: "graph TD\n  A --> B", kind: .flowchart(chart))),
        ]

        #expect(MarkdownBlock.blocks(in: "```mermaid\ngraph TD\n  A --> B\n```") == expected)
    }

    /// Degrade-down: a diagram nothing here can read is the grey source it is today, info label and
    /// all — never an error and never an empty box.
    @Test
    func `a mermaid fence Argo cannot read stays a fence`() {
        #expect(MarkdownBlock.blocks(in: "```mermaid\nC4Context\n  Person(dev, \"Dev\")\n```") == [
            .fenced(code: "C4Context\n  Person(dev, \"Dev\")", info: "mermaid"),
        ])
    }

    /// Half a diagram is a diagram nobody wrote. A fence still arriving keeps its characters until
    /// the agent closes it.
    @Test
    func `an unterminated mermaid fence stays a fence`() {
        #expect(MarkdownBlock.blocks(in: "```mermaid\ngraph TD\n  A --> B") == [
            .fenced(code: "graph TD\n  A --> B", info: "mermaid"),
        ])
    }

    /// A CLI writes at the terminal's measure, so a run of lines it meant as one block is joined as
    /// it was written rather than reflowed.
    @Test
    func `a paragraph keeps the line breaks the record carries, and a blank line ends it`() {
        #expect(MarkdownBlock.blocks(in: "one\ntwo\n\nthree") == [
            .paragraph("one\ntwo"),
            .paragraph("three"),
        ])
    }

    @Test
    func `a whole answer comes apart into the blocks it was written as`() {
        let text = "## Findings\n\nThe ramp drifted.\n\n- two of them\n\n```swift\nlet a = 1\n```"

        #expect(MarkdownBlock.blocks(in: text) == [
            .heading(level: 2, text: "Findings"),
            .paragraph("The ramp drifted."),
            .bullet("two of them"),
            .fenced(code: "let a = 1", info: "swift"),
        ])
    }

    /// The one source every picture case below is written against.
    private static let source = "https://example.com/a.png"

    /// A tracker writes a screenshot on a line of its own, and that is the one shape the feed can
    /// draw as a picture — words beside one would have nowhere to wrap.
    @Test
    func `a line that is only an image is a picture`() throws {
        let source = try #require(URL(string: Self.source))

        #expect(MarkdownBlock.blocks(in: "![Atlas shading](\(Self.source))") == [
            .picture(alt: "Atlas shading", source: source),
        ])
    }

    /// The alt text is kept because it is what stands in for the picture: while the bytes are on
    /// their way, and where they turn out not to be readable.
    @Test
    func `an image with no alt text is still a picture`() throws {
        let source = try #require(URL(string: Self.source))

        #expect(MarkdownBlock.blocks(in: "![](\(Self.source))") == [
            .picture(alt: "", source: source),
        ])
    }

    /// Markdown's optional title, which nothing here draws. Taken off rather than folded into the
    /// source, or the fetch asks for a URL with a quoted phrase on the end of it.
    @Test
    func `an image drops the title markdown lets it carry`() throws {
        let source = try #require(URL(string: Self.source))

        #expect(MarkdownBlock.blocks(in: "![a](\(Self.source) \"The city\")") == [
            .picture(alt: "a", source: source),
        ])
    }

    /// Two on one line is not one picture with the first one inside its alt text. A backwards
    /// search for `](` read exactly that, and dropped the first image without a word.
    @Test
    func `two images on one line are prose, not one picture`() {
        let line = "![a](https://example.com/1.png) ![b](https://example.com/2.png)"

        #expect(MarkdownBlock.blocks(in: line) == [.paragraph(line)])
    }

    /// Words share the line, so there is no block here — prose that happens to hold a mark.
    @Test
    func `an image inside a sentence stays prose`() {
        #expect(MarkdownBlock.blocks(in: "see ![a](https://example.com/a.png) here") == [
            .paragraph("see ![a](https://example.com/a.png) here"),
        ])
    }

    /// Degrade-down: nothing to fetch is nothing to draw, and the characters the agent wrote are
    /// the honest thing to leave standing. `URL(string:)` alone would not settle this — it
    /// percent-encodes the phrase and calls it a URL — so the SCHEME is what decides.
    @Test(arguments: ["![a](not a url)", "![a](/docs/a.png)", "![a](file:///tmp/a.png)"])
    func `an image whose source is no web address stays prose`(line: String) {
        #expect(MarkdownBlock.blocks(in: line) == [.paragraph(line)])
    }
}
