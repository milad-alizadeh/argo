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

    /// A diagram laid out. The renderer AND the overview lane both come here, so their geometry is
    /// one layout rather than two implementations that happen to agree — which is what makes their
    /// heights match by construction (#860).
    ///
    /// Keyed on the source and nothing else, because a diagram is as big as the thing it draws: one
    /// too wide for the column is scrolled rather than reflowed, so there is no second width for a
    /// second layout to answer at (#861).
    static func plan(of diagram: MermaidDiagram) -> MermaidPlan {
        plans.reading(of: diagram.source) { _ in diagram.laid }
    }

    /// The stores a whole-document walk reaches, held to the document it is about to cross — see
    /// `ProseCache`. Only these two: `structure(of:)` is what a prose row is asked for, and a miss
    /// there is a miss in `scans` behind it.
    static func holding(rows: Int) {
        structures.hold(atLeast: rows)
        scans.hold(atLeast: rows)
    }

    #if DEBUG
        /// What the whole-document store hit and missed, so the working set is measured rather than
        /// asserted. DEBUG for the reason `FeedPaneCost` states.
        static var structureCost: ProseCacheCost {
            structures.cost
        }
    #endif
}
