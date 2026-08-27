import Foundation

/// What a fresh reading asks of the table: extend what stands, or start over.
///
/// The decision on its own, out of the coordinator, because it is the one piece of the diffing a
/// test can hold without an `NSTableView`: appends are the live case and must stay appends — a
/// reload tears down every visible cell once per arriving row — and everything that is not
/// provably an append reloads, because a wrong insert is a crash and a wrong reload is only work.
enum FeedTableDelta: Equatable {
    /// The fresh reading extends the shown one. `arrived` is the appended tail (possibly empty);
    /// `rewritten` is the already-shown rows the arrival invalidated.
    case append(arrived: Range<Int>, rewritten: IndexSet)
    case reload

    static func between(_ stale: [FeedRow], and fresh: [FeedRow]) -> FeedTableDelta {
        guard fresh.count >= stale.count, fresh.starts(with: stale.dropLast()) else {
            return .reload
        }
        return .append(arrived: stale.count ..< fresh.count, rewritten: rewritten(stale, fresh))
    }

    /// Two rows an append leaves wrong on screen. The last shown one, which a live transcript
    /// rewrites as the call in it is answered. And the one that was drawing the Turn's copy chip,
    /// because the arriving rows move it (`FeedCopy.chipOffer`) — a row nobody re-asks goes on
    /// drawing a chip the Turn has taken off it, at the height it needed to.
    private static func rewritten(_ stale: [FeedRow], _ fresh: [FeedRow]) -> IndexSet {
        var rows = IndexSet()
        if let seam = stale.indices.last {
            rows.insert(seam)
        }
        if let stood = chipRow(stale), chipRow(fresh) != stood {
            rows.insert(stood)
        }
        return rows
    }

    /// Where the chip that can still move stands — the last message of the reading, which is the
    /// last message of its Turn until another arrives. Every chip above it is inside a Turn the
    /// arrival cannot reach.
    private static func chipRow(_ rows: [FeedRow]) -> Int? {
        rows.lastIndex { $0.kind.isMessage }
    }
}
