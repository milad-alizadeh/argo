import ArgoEngine
import SwiftUI

/// One `FeedGeometry` per reading, held above every view identity a switch destroys.
///
/// A height is kept under a `Ground` that names the row it is a fact about, so a single store
/// shared across readings answers no question WRONG — but the miss overwrites: reading B measures
/// its rows into the indices A's were at, so A → B → A costs two full readings, which is what a
/// reader browsing the roster actually does (#858).
///
/// Keyed by `FeedReading` and bounded, evicted oldest-first (ADR-0028 Rule 4): a store per Session
/// the window has ever shown is an unbounded cache of held rows. Bounded by COUNT alone, unlike
/// the readings themselves — a geometry holds one measured height per row, so
/// `ReadingCeilings.readings` of the longest readings here is under a megabyte, and a byte ceiling
/// would be a gate that can never fire.
@MainActor final class FeedGeometries {
    private var kept: [(reading: FeedReading, geometry: FeedGeometry)] = []

    /// This reading's heights, made on first sight. Touching the LRU order is the whole of the
    /// write, which is why a `body` may ask: nothing observes this, so nothing re-renders for it.
    func geometry(for reading: FeedReading) -> FeedGeometry {
        #if DEBUG
            Self.reach.lookups += 1
            Self.reach.stores.insert(ObjectIdentifier(self))
        #endif
        if let found = kept.firstIndex(where: { $0.reading == reading }) {
            kept.append(kept.remove(at: found))
            return kept[kept.count - 1].geometry
        }
        let geometry = FeedGeometry()
        kept.append((reading: reading, geometry: geometry))
        if kept.count > ReadingCeilings.readings {
            kept.removeFirst(kept.count - ReadingCeilings.readings)
        }
        return geometry
    }

    /// How many readings are held, for the suite that asks what the ceiling does.
    var count: Int {
        kept.count
    }

    #if DEBUG
        /// See `FeedGeometriesReach`.
        static var reach = FeedGeometriesReach()
    #endif
}

/// Which stores the shell has actually handed a table, and how many times — the gate on #858's
/// WIRING rather than on its mechanism.
///
/// The identity is the whole of it. Every claim about what one store remembers is satisfied by a
/// store MADE PER PASS, and a reader coming back to a reading still pays for all of it, because
/// the table was bound to a different store each time. That is what injecting a fresh
/// `FeedGeometries()` at `CockpitView.detail(tickets:reading:)` does, and nothing that drives a
/// store directly can see it.
struct FeedGeometriesReach {
    /// One entry per store a table was bound to. A set, because the claim is about how MANY
    /// distinct stores reached a table over a run of body passes, not about the order.
    var stores: Set<ObjectIdentifier> = []
    var lookups = 0

    @MainActor static func forget() {
        #if DEBUG
            FeedGeometries.reach = FeedGeometriesReach()
        #endif
    }
}

extension EnvironmentValues {
    /// Where the deck's feed keeps its measured heights, injected by the one view above every
    /// switch that would otherwise destroy them — see `CockpitView.detail(tickets:reading:)`.
    /// `nil` in a preview and in a specimen, where each table owns its own and nothing switches.
    @Entry var argoFeedGeometries: FeedGeometries?
}
