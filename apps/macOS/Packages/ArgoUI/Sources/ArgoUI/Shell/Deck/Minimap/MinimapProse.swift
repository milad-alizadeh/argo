import Foundation

/// One block of a prose row's markdown, reduced to the few numbers the lane draws it with: a table
/// reads as its grid, a fence as its slab, a link in the ink the feed gives it. Built once per
/// distinct text and cached — see `ProseReading.structure(of:)`.
struct MinimapProseBlock: Equatable, Sendable {
    /// What the block draws as. Prose flows as ragged bars; a table is a stroked grid; a fence is
    /// one solid slab, the box the feed draws around its code.
    enum Kind: Equatable, Sendable {
        case prose
        case table
        case fence
    }

    var kind: Kind
    /// UTF-8 length of the block's text — what raggedness and the block's share are read from.
    var length: Int
    /// The lines the source itself states — a fence's code lines, a table's rows with its header.
    /// `nil` for prose, which flows at the column's measure.
    var sourceLines: Int?
    /// Where the block's links sit, as UTF-8 offsets into its text.
    var links: [MinimapLinkSpan] = []
    /// The words themselves, for a block whose lines the lane draws at the widths they really
    /// wrapped to. Prose only: a fence and a table are drawn as their own shape.
    var text = ""
    /// A table's cells as their UTF-8 lengths, header row first. What its columns and its rows are
    /// dealt by — see `MinimapRuns.cells`. Lengths and not the words, because the lane draws the
    /// grid and never the text inside it.
    var cells: [[Int]] = []
}

/// One markdown link's place in its block, `[label](url)` and all. The lane marks the source's own
/// span — where, never what.
struct MinimapLinkSpan: Equatable, Sendable {
    var offset: Int
    var length: Int
}

extension MinimapProseBlock {
    /// Whether the lane draws this block as anything other than plain prose lines.
    var isStructural: Bool {
        kind != .prose || !links.isEmpty
    }

    /// The shape a prose row draws as: its ragged lines, unless the markdown carries structure the
    /// lane can say — then the blocks themselves.
    @MainActor static func shape(of text: String, ink: FeedInk) -> MinimapRowShape {
        let blocks = ProseReading.structure(of: text)
        guard blocks.contains(where: \.isStructural) else {
            return .prose(text: text, ink: ink)
        }
        return .composed(blocks: blocks, ink: ink)
    }

    /// The read blocks, reduced. Merged nowhere: two paragraphs lay out the same joined or apart,
    /// and a block that keeps its own edges keeps its own links.
    static func blocks(from markdown: [MarkdownBlock]) -> [MinimapProseBlock] {
        markdown.map { block in
            switch block {
            case let .heading(_, text), let .paragraph(text), let .bullet(text),
                 let .numbered(_, text):
                MinimapProseBlock(
                    kind: .prose,
                    length: text.utf8.count,
                    links: links(in: text),
                    text: text,
                )
            case let .fenced(code, _):
                MinimapProseBlock(
                    kind: .fence,
                    length: code.utf8.count,
                    sourceLines: max(1, code.components(separatedBy: "\n").count),
                )
            case let .table(table):
                MinimapProseBlock(
                    kind: .table,
                    length: (table.header + table.rows.joined())
                        .reduce(0) { $0 + $1.utf8.count },
                    sourceLines: table.rows.count + 1,
                    cells: ([table.header] + table.rows).map { row in
                        row.map(\.utf8.count)
                    },
                )
            }
        }
    }

    /// `[label](url)` spans, by UTF-8 offset. A scan and not a markdown parse: the lane needs
    /// where a link stands, never what it says.
    static func links(in text: String) -> [MinimapLinkSpan] {
        var spans: [MinimapLinkSpan] = []
        let bytes = Array(text.utf8)
        var at = 0
        while at < bytes.count {
            guard bytes[at] == UInt8(ascii: "["),
                  let label = bytes.first(UInt8(ascii: "]"), from: at + 1),
                  bytes.indices.contains(label + 1), bytes[label + 1] == UInt8(ascii: "("),
                  let close = bytes.first(UInt8(ascii: ")"), from: label + 2)
            else {
                at += 1
                continue
            }
            spans.append(MinimapLinkSpan(offset: at, length: close - at + 1))
            at = close + 1
        }
        return spans
    }
}

private extension [UInt8] {
    func first(_ byte: UInt8, from: Int) -> Int? {
        self[Swift.min(from, count)...].firstIndex(of: byte)
    }
}
