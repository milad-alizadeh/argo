import Foundation
import MermaidLayout
import ProseText

/// One block of a prose row, as the lane needs it to lay the block out again exactly as
/// `FeedMarkdown` laid it out: the same words, at the same face, at the same indent. Built once per
/// distinct text and cached — see `ProseReading.structure(of:)`.
///
/// It carries the words and never a length. A count of characters is what the lane used to divide
/// into lines and widths, and that division is where the map and the reading parted company.
enum MinimapProseBlock: Equatable, Sendable {
    /// Words that wrap — a paragraph, a heading, one item of a list.
    case prose(MinimapProseWords)
    /// A fence: the box the feed draws around its code, filled. Its own lines and whether it
    /// declared a language, which is a label above the code.
    case fence(lines: Int, hasInfo: Bool)
    /// A pipe table, whole. The table itself and not a reduction of it, so the lane deals its
    /// columns through the very function the feed's own layout deals them with.
    case table(MarkdownTable)
    /// A drawn diagram, whole, for the same reason: the lane lays it out through the one cached
    /// plan the renderer draws, so its silhouette and its height are the diagram's own.
    case diagram(MermaidDiagram)
}

/// A run of wrapping words and the two things that decide where they start.
struct MinimapProseWords: Equatable, Sendable {
    var text: String
    var face: ProseFace = .body
    /// The marker a list item is drawn with, trailing-aligned in its own column. `nil` for
    /// everything that is not one.
    var marker: String?

    /// How far the words themselves are held off the leading edge — a list item's marker column and
    /// the gap after it, which is what keeps a wrapped item inside its own words.
    var indent: CGFloat {
        marker == nil ? 0 : ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap
    }
}

extension MinimapProseBlock {
    /// The shape a prose row draws as. Always composed, a bare paragraph included: one path through
    /// the blocks means a heading cannot be reported at a paragraph's face by a second one.
    @MainActor static func shape(of text: String, ink: FeedInk) -> MinimapRowShape {
        .composed(blocks: ProseReading.structure(of: text), ink: ink)
    }

    /// The read blocks, as the lane lays them out. Merged nowhere: two paragraphs lay out the same
    /// joined or apart, and a block that keeps its own edges keeps its own links.
    static func blocks(from markdown: [MarkdownBlock]) -> [MinimapProseBlock] {
        markdown.map { block in
            switch block {
            case let .paragraph(text):
                .prose(MinimapProseWords(text: text))
            case let .heading(level, text):
                .prose(MinimapProseWords(text: text, face: .heading(level: level)))
            case let .bullet(text):
                .prose(MinimapProseWords(text: text, marker: "•"))
            case let .numbered(marker, text):
                .prose(MinimapProseWords(text: text, marker: marker))
            case let .fenced(code, info):
                .fence(
                    lines: max(1, code.components(separatedBy: "\n").count),
                    hasInfo: info != nil,
                )
            case let .table(table):
                .table(table)
            case let .diagram(diagram):
                .diagram(diagram)
            }
        }
    }
}
