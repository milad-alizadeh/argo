@testable import ArgoUI
import SwiftUI
import Testing

/// When the document that stands survives a re-wrap, and when it may not (#1132).
///
/// Keeping it is what stops the deck blanking on a drag frame and what keeps the reader's place: a
/// surrender empties `shown`, and `shown` is what the landing anchor is read from. But it is only
/// honest where every height the document holds is still true of the row it stands for — so the
/// reading may have grown at its tail, and may have rewritten its last row, and nothing else.
@Suite("Feed standing document")
struct FeedStandingDocumentTests {
    private static func stamp(_ rows: [FeedRow], atWidth width: CGFloat = 800) -> FeedMeasureStamp {
        FeedMeasureStamp(
            width: width,
            ink: FeedCellEnvironment.Ink(colorScheme: .dark, dynamicTypeSize: .medium),
            rows: rows,
            reader: FeedReaderStanding(),
        )
    }

    private static func reading(_ count: Int, from: Int = 0) -> [FeedRow] {
        (from ..< from + count).map { FeedRow(id: $0, content: .message("Line \($0).")) }
    }

    /// The case it exists for.
    @Test
    func `a reading grown at its tail keeps the document`() {
        let stood = Self.stamp(Self.reading(10))
        let grown = Self.stamp(Self.reading(12))

        #expect(stood.stands(under: grown))
    }

    /// The same reading is trivially still it.
    @Test
    func `an unchanged reading keeps the document`() {
        let stood = Self.stamp(Self.reading(10))

        #expect(stood.stands(under: Self.stamp(Self.reading(10))))
    }

    /// A reading that SHRANK. This used to trap: `extends` indexes the fresh rows at
    /// `stale.count - 2` with no bound of its own, and the only other caller guards the count
    /// before reaching it. A compaction, or a Session with less in it than the last, is a real
    /// reading — and one that arrives with a re-wrap, since an ink change alone is a re-wrap.
    @Test
    func `a reading that shrank does not keep the document`() {
        let stood = Self.stamp(Self.reading(10))

        #expect(stood.stands(under: Self.stamp(Self.reading(3))) == false)
        #expect(stood.stands(under: Self.stamp([])) == false)
    }

    /// A different reading of the same length is not this one.
    @Test
    func `another reading of the same length does not keep the document`() {
        let stood = Self.stamp(Self.reading(10))

        #expect(stood.stands(under: Self.stamp(Self.reading(10, from: 100))) == false)
    }

    /// A single-row document may not be kept under an arbitrary reading. `extends` compares the
    /// fresh rows against the stale ones MINUS the last — which for one row is nothing at all, so
    /// every reading trivially extends it. One row is one height to take again, and taking it is
    /// cheaper than being wrong about it.
    @Test
    func `a one row document does not keep itself under another reading`() {
        let stood = Self.stamp(Self.reading(1))

        #expect(stood.stands(under: Self.stamp(Self.reading(9, from: 50))) == false)
    }
}
