import MermaidLayout
import ProseText
import SwiftUI

/// How a string of the record was read, kept so it is read once. A view body is evaluated far more
/// often than its text changes: a seam under the reader's finger invalidates every visible row
/// 60–120 times a second, and a prompt draws its prose three times over — the visible copy plus the
/// two measures that decide its fold.
///
/// Keyed by the text and nothing else. A cache in the strict sense — rebuildable from the string
/// alone, bounded, correct to drop at any moment — and NOT a field on `FeedRow`, whose projection
/// stays verbatim.
@MainActor
enum ProseReading {
    private static var scans = ProseCache<[MarkdownBlock]>()
    private static var structures = ProseCache<[MinimapProseBlock]>()

    /// The agent's own inline marks. Held in `ProseMarks`, under the feed, because every width the
    /// feed measures rests on it — this name is where the rest of the feed asks.
    static func marked(_ text: String) -> AttributedString {
        ProseMarks.marked(text)
    }

    /// The blocks the agent gave the message its shape with.
    static func blocks(in text: String) -> [MarkdownBlock] {
        scans.reading(of: text) { MarkdownBlock.blocks(in: $0) }
    }

    /// The same blocks reduced to what the overview lane draws — see `MinimapProseBlock`.
    static func structure(of text: String) -> [MinimapProseBlock] {
        structures.reading(of: text) { MinimapProseBlock.blocks(from: blocks(in: $0)) }
    }

    /// A diagram laid out — the renderer holds that store now that it is a package, so this is a
    /// forward. Named here still because this is where the feed asks for every other reading.
    static func plan(of diagram: MermaidDiagram) -> MermaidPlan {
        diagram.plan
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
