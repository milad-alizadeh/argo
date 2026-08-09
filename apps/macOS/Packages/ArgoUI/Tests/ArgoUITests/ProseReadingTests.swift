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
        #expect(cache.count == 2)
    }

    /// The bound is the point: a session read all day must not grow it without end. What replaces
    /// a dropped entry is a re-read, which is correct — this is a cache and never a store.
    @Test
    func `it never holds more readings than its ceiling`() {
        var cache = ProseCache<Int>(ceiling: 4)

        for line in 0 ..< 40 {
            _ = cache.reading(of: "line \(line)") { _ in line }
        }

        #expect(cache.count <= 4)
    }

    @Test
    func `a reading dropped at the ceiling is read again, not lost`() {
        var cache = ProseCache<String>(ceiling: 2)

        _ = cache.reading(of: "first") { $0 }
        for line in 0 ..< 8 {
            _ = cache.reading(of: "line \(line)") { $0 }
        }

        #expect(cache.reading(of: "first") { $0 } == "first")
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
