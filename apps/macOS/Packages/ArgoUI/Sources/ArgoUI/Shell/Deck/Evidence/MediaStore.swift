import Foundation

/// Decoded pictures held under a cost ceiling ARGO owns, and dropped in the order they went cold.
///
/// This was an `NSCache`, and `NSCache` holds nothing it has promised to hold: its removal policy
/// is documented as a hint, and on Darwin it empties itself wholesale on a system memory-pressure
/// notification. So a plate filed one statement ago could be gone by the next, and the claims the
/// cache exists to make — this byte run is decoded ONCE, the plate a surface holds is still the one
/// it was handed — were true only while the machine was quiet. Running the decode suite alone on an
/// ordinary desk, with no load generator anywhere, it dropped every one of forty entries under a
/// ceiling with room for eighty, in 33 runs out of 40 (#1001).
///
/// Owning the store is what makes the ceiling Argo's, which is the whole of ADR-0028 Rule 4: the
/// bound derives from the window and the display, not from the OS's opinion of the moment. The
/// trade is that Argo no longer hands these pixels back under memory pressure — affordable only
/// because the ceiling is a fixed two windowfuls and never grows with the transcript.
///
/// Recency and not insertion order, because the working set is the window being read plus one of
/// scrollback behind it: a scroll up and back must re-draw rather than re-decode.
final class MediaStore {
    /// What may be resident, in bytes. Read-only after `init`, like the display it derives from.
    let costLimit: Int

    private var pictures: [String: MediaBitmap] = [:]
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
        guard let picture = pictures[key] else { return nil }
        touch(key)
        return picture
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
        pictures[key] = picture
        recency.append(key)
        resident += cost
    }

    private func touch(_ key: String) {
        recency.removeAll { $0 == key }
        recency.append(key)
    }

    private func remove(_ key: String) {
        guard let picture = pictures.removeValue(forKey: key) else { return }
        resident -= picture.cost
        recency.removeAll { $0 == key }
    }
}
