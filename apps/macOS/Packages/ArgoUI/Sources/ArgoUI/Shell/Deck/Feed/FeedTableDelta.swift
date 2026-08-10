import Foundation

/// What a fresh reading asks of the table: extend what stands, or start over.
///
/// The decision on its own, out of the coordinator, because it is the one piece of the diffing a
/// test can hold without an `NSTableView`: appends are the live case and must stay appends — a
/// reload tears down every visible cell once per arriving row — and everything that is not
/// provably an append reloads, because a wrong insert is a crash and a wrong reload is only work.
enum FeedTableDelta: Equatable {
    /// The fresh reading extends the shown one. `arrived` is the appended tail (possibly empty);
    /// `rewritten` is the last already-shown row, which a live transcript rewrites as the call in
    /// it is answered — sometimes with rows appended after it and sometimes alone.
    case append(arrived: Range<Int>, rewritten: Int?)
    case reload

    static func between(_ stale: [FeedRow], and fresh: [FeedRow]) -> FeedTableDelta {
        guard fresh.count >= stale.count, fresh.starts(with: stale.dropLast()) else {
            return .reload
        }
        return .append(arrived: stale.count ..< fresh.count, rewritten: stale.indices.last)
    }
}
