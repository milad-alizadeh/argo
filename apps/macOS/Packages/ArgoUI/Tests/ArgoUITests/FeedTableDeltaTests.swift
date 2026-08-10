@testable import ArgoUI
import Testing

/// Append or reload — the table's whole diffing decision, held against real projection rows.
///
/// The append arm must stay narrow: a wrong insert is an `NSTableView` crash at runtime, so
/// everything not provably an extension of the shown reading reloads. The last shown row rides
/// every append as `rewritten` because a live transcript rewrites its newest row as the call in
/// it is answered — the suite pins that it is re-asked even when nothing arrived.
@Suite("Feed table delta")
struct FeedTableDeltaTests {
    private static let reading = FeedProjection.previewRows

    @Test
    func `rows arriving at the end are an append, and the seam row is re-asked`() {
        let delta = FeedTableDelta.between(
            Array(Self.reading.prefix(3)), and: Array(Self.reading.prefix(5)),
        )
        #expect(delta == .append(arrived: 3 ..< 5, rewritten: 2))
    }

    @Test
    func `the newest row rewritten in place is an append that inserts nothing`() {
        var fresh = Array(Self.reading.prefix(3))
        fresh[2] = Self.reading[4]
        let delta = FeedTableDelta.between(Array(Self.reading.prefix(3)), and: fresh)
        #expect(delta == .append(arrived: 3 ..< 3, rewritten: 2))
    }

    @Test
    func `a fresh reading opening on an empty table appends everything`() {
        let delta = FeedTableDelta.between([], and: Array(Self.reading.prefix(2)))
        #expect(delta == .append(arrived: 0 ..< 2, rewritten: nil))
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
