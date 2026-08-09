@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// What the reading cache promises. Two claims, and they are the whole of it: a string is read
/// once, and what comes back is what a fresh read would have produced.
///
/// The performance the ticket is about is not assertable here — no unit test can say a body ran
/// 60 times a second. What IS assertable is the property the performance rests on, which is that
/// the second read of the same string does no work.
@Suite("Prose reading")
struct ProseReadingTests {
    @Test
    func `a string is read once, however many times it is drawn`() {
        var cache = ProseCache<Int>()
        var reads = 0

        for _ in 0 ..< 3 {
            _ = cache.reading(of: "the same prompt") { _ in
                reads += 1
                return reads
            }
        }

        #expect(reads == 1)
    }

    @Test
    func `each distinct string is read on its own`() {
        var cache = ProseCache<String>()

        #expect(cache.reading(of: "one") { $0.uppercased() } == "ONE")
        #expect(cache.reading(of: "two") { $0.uppercased() } == "TWO")
    }

    /// The bound is the point: a session read all day must not grow the store without end. What
    /// says it held is a string read once, then read AGAIN after enough others went past it — the
    /// second read is the entry having been dropped, observed from outside.
    @Test
    func `a string is read again once enough others have gone past it`() {
        var cache = ProseCache<String>(ceiling: 2)
        var reads = 0
        let read = { (text: String) in
            reads += 1
            return text
        }

        _ = cache.reading(of: "first", read: read)
        for line in 0 ..< 8 {
            _ = cache.reading(of: "line \(line)", read: read)
        }
        let readsBefore = reads

        // Not lost, only dropped: what comes back is the same reading, freshly made.
        #expect(cache.reading(of: "first", read: read) == "first")
        #expect(reads == readsBefore + 1)
    }

    @MainActor
    @Test
    func `the inline marks read through the cache are the marks themselves`() {
        let text = "Read `FeedView.swift` and the **ramp** first."
        let direct = (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace),
        )) ?? AttributedString(text)

        #expect(ProseReading.marked(text) == direct)
        #expect(ProseReading.marked(text) == direct)
    }

    /// A string markdown cannot read arrives as it was written. Cached or not, the words are the
    /// agent's and nothing here is allowed to change them.
    @MainActor
    @Test
    func `a string that cannot be parsed is kept verbatim`() {
        let text = "An unclosed [link( and a stray ` backtick"

        #expect(String(ProseReading.marked(text).characters) == text)
    }

    @MainActor
    @Test
    func `the blocks read through the cache are the blocks themselves`() {
        let text = "## What I found\n\n- one\n- two\n\n```swift\nlet x = 1\n```"

        #expect(ProseReading.blocks(in: text) == MarkdownBlock.blocks(in: text))
        #expect(ProseReading.blocks(in: text) == MarkdownBlock.blocks(in: text))
    }
}
