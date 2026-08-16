@testable import ArgoUI
import Foundation
import Testing

/// A prose row's markdown, as the lane reads it (#382): the same words at the same face and the
/// same indent `FeedMarkdown` draws them at.
///
/// It carries the words and never a length. A count of characters is what the lane used to divide
/// into lines and widths, and that division is where the map and the reading parted company.
@Suite("Minimap prose structure")
struct MinimapProseTests {
    @Test @MainActor
    func `plain prose is a single block of body words`() {
        let shape = MinimapProseBlock.shape(of: "Nothing but words here.", ink: .message)
        #expect(shape == .composed(
            blocks: [.prose(MinimapProseWords(text: "Nothing but words here."))],
            ink: .message,
        ))
    }

    @Test @MainActor
    func `markdown with a table composes into blocks in the order they are drawn`() {
        let text = "Before.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter."
        guard case let .composed(blocks, ink) = MinimapProseBlock.shape(of: text, ink: .message)
        else {
            Issue.record("expected a composed shape")
            return
        }
        #expect(ink == .message)
        #expect(blocks.count == 3)
        #expect(blocks[1] == .table(MarkdownTable(header: ["a", "b"], rows: [["1", "2"]])))
    }

    /// A heading is set at its own rung and a paragraph at the body's. Read at one face they came
    /// out the same height, which is a line the row never drew.
    @Test
    func `a heading keeps its own face and a paragraph the body's`() {
        let blocks = Self.blocks(of: "## What I found\n\nThe ramp had drifted.")
        #expect(blocks == [
            .prose(MinimapProseWords(text: "What I found", face: .heading(level: 2))),
            .prose(MinimapProseWords(text: "The ramp had drifted.")),
        ])
    }

    @Test(arguments: [1, 2, 3, 6])
    func `three rungs cover six heading levels`(level: Int) {
        let hashes = String(repeating: "#", count: level)
        let blocks = Self.blocks(of: "\(hashes) Title")
        #expect(blocks == [
            .prose(MinimapProseWords(text: "Title", face: .heading(level: level))),
        ])
        #expect(ProseFace.heading(level: level).isBold)
    }

    /// A list item carries its marker, which is what puts its words past the marker column — and a
    /// numbered item keeps the host's own number, because that is what the row draws.
    @Test
    func `a list item carries the marker it is drawn with`() {
        #expect(Self.blocks(of: "- first") == [
            .prose(MinimapProseWords(text: "first", marker: "•")),
        ])
        #expect(Self.blocks(of: "3. third") == [
            .prose(MinimapProseWords(text: "third", marker: "3.")),
        ])
    }

    @Test
    func `only a list item is indented`() {
        #expect(MinimapProseWords(text: "words").indent == 0)
        #expect(MinimapProseWords(text: "words", marker: "•").indent > 0)
    }

    @Test
    func `a fence knows its own line count and whether it named a language`() {
        #expect(Self.blocks(of: "```swift\nlet a = 1\nlet b = 2\n```") == [
            .fence(lines: 2, hasInfo: true),
        ])
        #expect(Self.blocks(of: "```\nlet a = 1\n```") == [.fence(lines: 1, hasInfo: false)])
    }

    private static func blocks(of text: String) -> [MinimapProseBlock] {
        MinimapProseBlock.blocks(from: MarkdownBlock.blocks(in: text))
    }
}
