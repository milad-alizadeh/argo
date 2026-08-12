@testable import ArgoUI
import Foundation
import Testing

/// A prose row's markdown structure, as the lane reads and lays it (#382): a table is its grid, a
/// fence its slab, a link its own ink — and plain prose stays exactly the shape it always was.
@Suite("Minimap prose structure")
struct MinimapProseTests {
    @Test @MainActor
    func `plain prose keeps the plain shape`() {
        let shape = MinimapProseBlock.shape(of: "Nothing but words here.", ink: .message)
        #expect(shape == .prose(text: "Nothing but words here.", ink: .message))
    }

    @Test @MainActor
    func `markdown with a table composes into blocks`() {
        let text = "Before.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter."
        guard case let .composed(blocks, ink) = MinimapProseBlock.shape(of: text, ink: .message)
        else {
            Issue.record("expected a composed shape")
            return
        }
        #expect(ink == .message)
        #expect(blocks.map(\.kind) == [.prose, .table, .prose])
        // The header row counts: two source rows say three drawn ones — header, rule, body.
        #expect(blocks[1].sourceLines == 2)
    }

    @Test
    func `a fence knows its own line count`() {
        let blocks = MinimapProseBlock.blocks(from: MarkdownBlock.blocks(
            in: "```swift\nlet a = 1\nlet b = 2\n```",
        ))
        #expect(blocks.map(\.kind) == [.fence])
        #expect(blocks[0].sourceLines == 2)
    }

    @Test
    func `a link is found at its own offset, source span and all`() {
        let spans = MinimapProseBlock.links(in: "See [the PR](https://a.b) for more.")
        #expect(spans == [MinimapLinkSpan(offset: 4, length: 21)])
    }

    @Test
    func `brackets without a link mark nothing`() {
        #expect(MinimapProseBlock.links(in: "an [aside] and (a parenthesis)").isEmpty)
        #expect(MinimapProseBlock.links(in: "unterminated [link](https://a").isEmpty)
    }

    @Test @MainActor
    func `a paragraph with a link composes so the lane can ink it`() {
        let shape = MinimapProseBlock.shape(of: "See [it](https://a.b).", ink: .message)
        guard case let .composed(blocks, _) = shape else {
            Issue.record("expected a composed shape")
            return
        }
        #expect(blocks.count == 1)
        #expect(!blocks[0].links.isEmpty)
    }
}

/// The composed layout: blocks divide the row's own drawn lines and never move the row.
@Suite("Minimap composed runs")
struct MinimapComposedTests {
    private static let measure: CGFloat = 720

    @Test
    func `blocks divide the row's lines and stay inside them`() {
        let runs = MinimapRuns.composed(
            [
                MinimapProseBlock(kind: .prose, length: 2000),
                MinimapProseBlock(kind: .table, length: 200, sourceLines: 5),
                MinimapProseBlock(kind: .prose, length: 2000),
            ],
            ink: .message,
            over: 12,
            across: Self.measure,
        )
        #expect(runs.allSatisfy { $0.line + $0.lines <= 12 })
        // One frame for the table, between the two paragraphs' bars.
        let frames = runs.filter { $0.ink == .table }
        #expect(frames.count == 1)
        let bars = runs.filter { $0.ink == .message }
        #expect(bars.contains { $0.line < frames[0].line })
        #expect(bars.contains { $0.line >= frames[0].line + frames[0].lines })
    }

    @Test
    func `a fence is one slab in the row's own ink`() {
        let runs = MinimapRuns.composed(
            [MinimapProseBlock(kind: .fence, length: 300, sourceLines: 8)],
            ink: .thought,
            over: 6,
            across: Self.measure,
        )
        #expect(runs == [MinimapRun(ink: .thought, line: 0, lines: 6, span: 0 ... 1)])
    }

    @Test
    func `a link is drawn in its own ink on the line its words flow to`() {
        var block = MinimapProseBlock(kind: .prose, length: 400)
        block.links = [MinimapLinkSpan(offset: 210, length: 30)]
        let runs = MinimapRuns.composed([block], ink: .message, over: 4, across: Self.measure)
        let links = runs.filter { $0.ink == .link }
        #expect(links.count == 1)
        // 400 characters over 4 lines is 100 a line, so offset 210 lands on the third.
        #expect(links[0].line == 2)
        #expect(links[0].span.lowerBound == 0.1)
    }

    @Test
    func `more blocks than lines still stays inside the row`() {
        let blocks = (0 ..< 6).map { _ in MinimapProseBlock(kind: .prose, length: 40) }
        let runs = MinimapRuns.composed(blocks, ink: .message, over: 2, across: Self.measure)
        #expect(!runs.isEmpty)
        #expect(runs.allSatisfy { $0.line + $0.lines <= 2 })
    }
}
