import SwiftUI

/// How a string of the record was read, kept so it is read once. A view body is evaluated far more
/// often than its text changes: a seam under the reader's finger invalidates every visible row
/// 60–120 times a second, and a prompt draws its prose three times over — the visible copy plus the
/// two rulers that decide its fold.
///
/// Keyed by the text and nothing else. A cache in the strict sense — rebuildable from the string
/// alone, bounded, correct to drop at any moment — and NOT a field on `FeedRow`, whose projection
/// stays verbatim.
@MainActor
enum ProseReading {
    private static var marks = ProseCache<AttributedString>()
    private static var scans = ProseCache<[MarkdownBlock]>()
    private static var structures = ProseCache<[MinimapProseBlock]>()
    private static var plans = ProseCache<MermaidPlan>()

    /// The agent's own inline marks. See `FeedProseText` for why the read is inline-only.
    static func marked(_ text: String) -> AttributedString {
        marks.reading(of: text) { text in
            let parsed = try? AttributedString(
                markdown: text,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace),
            )
            return parsed ?? AttributedString(text)
        }
    }

    /// The blocks the agent gave the message its shape with.
    static func blocks(in text: String) -> [MarkdownBlock] {
        scans.reading(of: text) { MarkdownBlock.blocks(in: $0) }
    }

    /// The same blocks reduced to what the overview lane draws — see `MinimapProseBlock`.
    static func structure(of text: String) -> [MinimapProseBlock] {
        structures.reading(of: text) { MinimapProseBlock.blocks(from: blocks(in: $0)) }
    }

    /// A diagram laid out across a measure. The renderer AND the overview lane both come here, so
    /// their geometry is one layout rather than two implementations that happen to agree — which is
    /// what makes their heights match by construction (#860).
    ///
    /// Keyed on the measure as well as the source, because the same diagram at two widths is two
    /// layouts, and a key of the text alone would answer a resized deck with the old one.
    static func plan(of diagram: MermaidDiagram, across measure: CGFloat) -> MermaidPlan {
        plans.reading(of: "\(measure)\u{0}\(diagram.source)") { _ in diagram.laid(across: measure) }
    }
}
