@testable import ArgoUI
import Foundation
import Testing

/// Append or reload — the table's whole diffing decision, held against real projection rows.
///
/// The append arm must stay narrow: a wrong insert is an `NSTableView` crash at runtime, so
/// everything not provably an extension of the shown reading reloads. The last shown row rides
/// every append as `rewritten` because a live transcript rewrites its newest row as the call in
/// it is answered — the suite pins that it is re-asked even when nothing arrived. The row drawing
/// the Turn's copy chip rides with it whenever the arrival moved the chip off it.
@Suite("Feed table delta")
struct FeedTableDeltaTests {
    private static let reading = FeedProjection.previewRows

    /// A Turn opened and answered: the chip stands on row 1.
    private static let said = [
        FeedRow(id: 7, content: .prompt(text: "Fix the seam", shots: [])),
        FeedRow(id: 8, content: .message("Found it.")),
    ]

    @Test
    func `rows arriving at the end are an append, and the seam row is re-asked`() {
        let delta = FeedTableDelta.between(
            Array(Self.reading.prefix(3)), and: Array(Self.reading.prefix(5)),
        )
        #expect(delta == .append(arrived: 3 ..< 5, rewritten: IndexSet(integer: 2)))
    }

    @Test
    func `the newest row rewritten in place is an append that inserts nothing`() {
        var fresh = Array(Self.reading.prefix(3))
        fresh[2] = Self.reading[4]
        let delta = FeedTableDelta.between(Array(Self.reading.prefix(3)), and: fresh)
        #expect(delta == .append(arrived: 3 ..< 3, rewritten: IndexSet(integer: 2)))
    }

    @Test
    func `a fresh reading opening on an empty table appends everything`() {
        let delta = FeedTableDelta.between([], and: Array(Self.reading.prefix(2)))
        #expect(delta == .append(arrived: 0 ..< 2, rewritten: IndexSet()))
    }

    /// The chip belongs to the last message of a Turn, so a message arriving later takes it off the
    /// one that had it — and a row nobody re-asks goes on drawing a chip the Turn has moved, at the
    /// height it needed (`FeedCopy.chipOffer`).
    @Test
    func `a message arriving re-asks the row it took the chip from`() {
        var fresh = Self.said
        fresh.append(FeedRow(id: 9, content: .call(RowKindFixture.answeredCall)))
        fresh.append(FeedRow(id: 10, content: .message("Fixed.")))

        #expect(FeedTableDelta.between(Self.said, and: fresh)
            == .append(arrived: 2 ..< 4, rewritten: IndexSet([1])))
    }

    /// Work arriving moves no chip, so the seam alone is re-asked.
    @Test
    func `work arriving re-asks the seam alone`() {
        var fresh = Self.said
        fresh.append(FeedRow(id: 9, content: .call(RowKindFixture.answeredCall)))

        #expect(FeedTableDelta.between(Self.said, and: fresh)
            == .append(arrived: 2 ..< 3, rewritten: IndexSet(integer: 1)))
    }

    @Test
    func `a row changing anywhere but the seam is a reload`() {
        var fresh = Self.reading
        fresh[0] = Self.reading[1]
        #expect(FeedTableDelta.between(Self.reading, and: fresh) == .reload)
    }

    @Test
    func `a reading that shrank is a reload`() {
        let delta = FeedTableDelta.between(Self.reading, and: Array(Self.reading.dropLast()))
        #expect(delta == .reload)
    }
}
