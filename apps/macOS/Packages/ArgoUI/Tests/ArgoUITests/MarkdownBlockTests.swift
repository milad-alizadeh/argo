@testable import ArgoUI
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
}
