import Foundation

/// The joins built for Projects this Hub has been pointed at, held across a switch — each with the
/// extents its readings were taken at.
///
/// Bounded, because a join holds every Session it read: a window left open all day would otherwise
/// pin the roster of every Project it ever visited. What the retention buys is a switch BACK, so
/// the bound is small — a Project untouched for four switches is a re-read nobody is sitting
/// through.
///
/// Keyed by the resolved Project path rather than by a Project id, because a path is what the
/// Hub has: registration lives above it. A Project that MOVES mid-process therefore misses its
/// own cache and re-reads, which is the honest degradation of that.
struct HubJoinCache {
    /// One Project's reading, whole: the join and the transcripts held READ whole inside it. The
    /// two travel together because neither is the reading on its own — a join restored without its
    /// extents is re-swept as though nothing had ever been opened, and the bounded re-read that
    /// follows REPLACES the whole readings it is standing on (#1213).
    struct Retained {
        let join: HubJoin
        let whole: WholeReadings
    }

    private struct Entry {
        let key: String
        let retained: Retained
    }

    private static let capacity = 4
    /// Newest use first.
    private var entries: [Entry] = []

    /// Hand a Project's reading back for keeping. An empty join is not kept: a join empties only
    /// when it is torn down, so storing one would overwrite the roster it was just taken from.
    mutating func retain(_ retained: Retained, for key: String) {
        guard !retained.join.isEmpty else { return }
        entries.removeAll { $0.key == key }
        entries.insert(Entry(key: key, retained: retained), at: 0)
        entries = Array(entries.prefix(Self.capacity))
    }

    /// Take a Project's reading back out. Removed rather than copied, so a join has one home at a
    /// time and the Hub's own copy is the only one anything writes into.
    mutating func take(for key: String) -> Retained? {
        guard let index = entries.firstIndex(where: { $0.key == key }) else { return nil }
        return entries.remove(at: index).retained
    }
}
