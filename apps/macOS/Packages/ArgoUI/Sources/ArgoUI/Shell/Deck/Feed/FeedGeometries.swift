import SwiftUI

/// One `FeedGeometry` per reading, held above every view identity a switch destroys.
///
/// A single store shared across readings is not enough, and the reason is the whole of #858's
/// remaining half. A height is kept under a `Ground` that names the row it is a fact about, so
/// showing another Session's rows through one store does not answer them WRONG — every question
/// simply misses. But the miss overwrites: reading B measures its rows into the indices A's were
/// at, so coming back to A finds B's grounds and measures A all over again. A → B → A cost two
/// full readings, which is what a reader browsing the roster actually does.
///
/// Keyed by `FeedReading` and bounded, evicted oldest-first (ADR-0028 Rule 4): a store per Session
/// the window has ever shown is an unbounded cache of held rows.
///
/// NOT `@Observable`, for `FeedGeometry`'s reason — nothing renders from it.
@MainActor final class FeedGeometries {
    /// Four, the number `SessionsRoomReadingCache` holds for the same browsing: a reader moving
    /// between a handful of readings touches all of them on every pass, so a smaller number
    /// evicts the one they are about to come back to.
    static let capacity = 4

    private var kept: [(reading: FeedReading, geometry: FeedGeometry)] = []

    /// This reading's heights, made on first sight. Touching the LRU order is the whole of the
    /// write, which is why a `body` may ask: nothing observes this, so nothing re-renders for it.
    func geometry(for reading: FeedReading) -> FeedGeometry {
        if let found = kept.firstIndex(where: { $0.reading == reading }) {
            kept.append(kept.remove(at: found))
            return kept[kept.count - 1].geometry
        }
        let geometry = FeedGeometry()
        kept.append((reading: reading, geometry: geometry))
        if kept.count > Self.capacity {
            kept.removeFirst(kept.count - Self.capacity)
        }
        return geometry
    }

    /// How many readings are held, for the suite that asks what the ceiling does.
    var count: Int {
        kept.count
    }
}

extension EnvironmentValues {
    /// Where the deck's feed keeps its measured heights, injected by the one view above every
    /// switch that would otherwise destroy them — see `CockpitView.detail(tickets:reading:)`.
    /// `nil` in a preview and in a specimen, where each table owns its own and nothing switches.
    @Entry var argoFeedGeometries: FeedGeometries?
}
