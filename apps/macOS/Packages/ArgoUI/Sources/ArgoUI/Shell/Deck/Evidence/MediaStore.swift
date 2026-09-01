import Foundation

/// Decoded pictures held under a cost ceiling ARGO owns, and dropped in the order they went cold.
///
/// `NSCache` holds nothing it has promised to hold: its removal policy is documented as a hint, and
/// on Darwin it empties itself wholesale on a system memory-pressure notification. ADR-0028's Rule
/// 4 amendment carries what that cost and why the store is here instead (#1001).
///
/// Recency and not insertion order, because the working set is the window being read plus one of
/// scrollback behind it: a scroll up and back must re-draw rather than re-decode. Lookup and the
/// eviction walk are both linear in the entry count, which the CEILING bounds at about a hundred —
/// never the transcript.
///
/// Nothing purges this but the ceiling: no memory-pressure hook replaced `NSCache`'s.
final class MediaStore {
    /// What may be resident, in bytes. Read-only after `init`, like the display it derives from.
    let costLimit: Int

    /// The cost is held BESIDE the picture and never recomputed. `MediaBitmap.cost` walks a mutable
    /// `NSImage`, so a refund read at eviction could differ from the charge read at filing, and
    /// `resident` would drift the same way for the life of the process — unbounded or starved, and
    /// silently either way.
    private struct Entry {
        let picture: MediaBitmap
        let cost: Int
    }

    private var entries: [String: Entry] = [:]
    /// Keys coldest-first — the order eviction walks.
    private var recency: [String] = []
    private var resident = 0

    init(costLimit: Int) {
        self.costLimit = costLimit
    }

    /// What is resident, in bytes. The store's own running total, not a walk of the entries.
    var totalCost: Int {
        resident
    }

    /// Whatever is held for `key`, and the reading counts as a use — this is the only thing that
    /// moves an entry away from the cold end.
    func object(for key: String) -> MediaBitmap? {
        guard let entry = entries[key] else { return nil }
        recency.removeAll { $0 == key }
        recency.append(key)
        return entry.picture
    }

    /// File `picture` under `key`, evicting from the cold end until it fits.
    ///
    /// A picture whose own cost is past the ceiling is NOT held, and nothing already held is given
    /// up for it — including whatever this key held before, which is still a decode some surface
    /// can draw. The caller keeps the bitmap it just decoded either way. No plate reaches that
    /// size, a plate being bounded by the surface it is drawn in, so this is a floor under the
    /// arithmetic rather than a live path.
    func set(_ picture: MediaBitmap, for key: String) {
        let cost = picture.cost
        guard cost <= costLimit else { return }
        remove(key)
        while resident + cost > costLimit, let coldest = recency.first {
            remove(coldest)
        }
        entries[key] = Entry(picture: picture, cost: cost)
        recency.append(key)
        resident += cost
    }

    /// The key leaves `recency` whether or not it was holding anything, so the walk above always
    /// shortens its own queue. A `remove` that returned early on a key `recency` still carried
    /// would spin on it, on the main actor.
    private func remove(_ key: String) {
        recency.removeAll { $0 == key }
        guard let entry = entries.removeValue(forKey: key) else { return }
        resident -= entry.cost
    }
}
