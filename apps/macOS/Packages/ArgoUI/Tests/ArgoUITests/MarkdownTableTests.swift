@testable import ArgoUI
import Testing

/// A pipe table was arriving as a paragraph, so the pipes were on the screen and the columns lined
/// up with nothing. What is asserted here is which blocks of pipes are a table and which are a
/// sentence — every cell's words are `FeedProseText`'s and are not this type's business.
@Suite("Markdown tables")
struct MarkdownTableTests {
    @Test
    func `a header, its rule and its body come apart into cells`() {
        let table = MarkdownTable.read([
            "| Ticket | Label |",
            "|---|---|",
            "| #474 | `ready-for-agent` |",
        ])

        #expect(table?.header == ["Ticket", "Label"])
        #expect(table?.rows == [["#474", "`ready-for-agent`"]])
    }

    /// The row of dashes is the whole signal. Without it a line of pipes is a sentence somebody
    /// wrote pipes in, and drawing it as a table would be inventing a shape the agent did not.
    @Test
    func `pipes with no rule under them are not a table`() {
        #expect(MarkdownTable.read(["| a | b |", "| c | d |"]) == nil)
        #expect(MarkdownTable.read(["| a | b |"]) == nil)
        #expect(MarkdownTable.read(["Use | to pipe.", "|---|"]) == nil)
    }

    /// Alignment colons are part of the rule's shape even though nothing acts on them, so a table
    /// written with them is still read as a table rather than falling back to a paragraph.
    @Test
    func `a rule carrying alignment colons is still a rule`() {
        #expect(MarkdownTable.read(["| a | b | c |", "|:--|:-:|--:|", "| 1 | 2 | 3 |"]) != nil)
    }

    /// A row the agent wrote short is drawn short. Padding keeps the columns; dropping the row or
    /// its cells would lose what was written.
    @Test
    func `a ragged row is padded to the header rather than dropped`() {
        let table = MarkdownTable.read(["| a | b | c |", "|---|---|---|", "| 1 |", "| 1 | 2 | 3 |"])

        #expect(table?.rows == [["1", "", ""], ["1", "2", "3"]])
    }

    @Test
    func `a table in a whole answer is one block among the others`() {
        let text = "## Queue\n\n| Ticket | Label |\n|---|---|\n| #474 | ready |\n\nThat is all."

        #expect(MarkdownBlock.blocks(in: text) == [
            .heading(level: 2, text: "Queue"),
            .table(MarkdownTable(header: ["Ticket", "Label"], rows: [["#474", "ready"]])),
            .paragraph("That is all."),
        ])
    }
}
