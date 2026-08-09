import SwiftUI

/// How a string of the record was read, kept so it is read once.
///
/// A body is not a place to parse. Both readings of a message — the inline marks and the blocks —
/// used to run on every evaluation of the view that drew them, and a view body is evaluated far
/// more often than its text changes: a seam under the reader's finger invalidates every visible row
/// 60–120 times a second, and a prompt draws its prose three times over, the visible copy plus the
/// two rulers that decide its fold.
///
/// Keyed by the text and nothing else, because the text is the whole of what a reading depends on.
/// This is a cache in the strict sense — rebuildable from the string alone, bounded, and correct to
/// drop at any moment — and it is deliberately NOT a field on `FeedRow`: how markdown is read is a
/// fact about drawing the words, never about what the agent said, and the projection stays
/// verbatim.
@MainActor
enum ProseReading {
    private static var marks = ProseCache<AttributedString>()
    private static var scans = ProseCache<[MarkdownBlock]>()

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
}

/// A bounded store of readings, keyed by the string each was read from.
///
/// Emptied whole at the ceiling rather than evicted by age. An LRU would keep the right entries,
/// and keeping them is worth less than what its bookkeeping costs on every hit: a miss here is one
/// parse of one string, which is the cost this type exists to pay once rather than the cost it
/// exists to avoid entirely.
struct ProseCache<Value> {
    /// Enough for the visible rows of a long turn several times over, so a scroll and a drag both
    /// stay inside it — and small enough that a session read all day cannot grow without bound.
    let ceiling: Int

    private var readings: [String: Value] = [:]

    /// Spelled out rather than left to the memberwise one, which a private stored property makes
    /// private — and the ceiling is exactly what a test needs to reach.
    init(ceiling: Int = 512) {
        self.ceiling = ceiling
    }

    var count: Int {
        readings.count
    }

    mutating func reading(of text: String, read: (String) -> Value) -> Value {
        if let known = readings[text] {
            return known
        }
        if readings.count >= ceiling {
            readings.removeAll(keepingCapacity: true)
        }
        let reading = read(text)
        readings[text] = reading
        return reading
    }
}
