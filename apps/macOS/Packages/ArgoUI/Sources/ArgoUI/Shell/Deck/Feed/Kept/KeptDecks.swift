import Foundation
import SwiftUI

/// Every deck the reader has open this launch, most recently shown last (ADR-0030, Rule 4).
///
/// One deck per Session — per READING, since scoping the rail onto a Subagent re-keys every row —
/// made on first sight and kept until the cap pushes it out. Leaving a deck is a hide and coming
/// back is a show, so a reader moving between Sessions never reloads a table and never re-measures
/// a document.
///
/// Bounded by COUNT alone, and by a much smaller count than the heights beside it: a deck holds an
/// `NSTableView` with realised cells in it, where a `FeedGeometry` holds one number per row.
///
/// NOT `@Observable`. Showing a deck touches the order, and a store that published that write would
/// re-render the view that asked from inside its own body pass. Every fact anything renders off is
/// on the deck itself.
@MainActor final class KeptDecks {
    /// The hidden `UserDefaults` default that moves the cap — no preference screen, because this is
    /// a number for the reader who has hit the ceiling rather than one anybody browses to.
    static let capDefault = "argo.keptSessions"

    /// Six kept decks, which is the cap ADR-0030 Rule 4 agreed.
    static let defaultCap = 6

    /// The cap in force for this launch, read ONCE: a cap that moved under a running window would
    /// evict a deck the reader is looking at, and the reading of it is not worth doing per pass.
    static let launchCap = cap(from: .standard)

    /// What the hidden default says, or the agreed six where it says nothing. A cap below one is
    /// not a smaller cache but a window that can hold no deck at all, so it floors at one.
    static func cap(from defaults: UserDefaults) -> Int {
        let asked = defaults.integer(forKey: capDefault)
        return asked > 0 ? asked : defaultCap
    }

    let cap: Int

    /// Least recently shown first, which is the order they are evicted in.
    private(set) var decks: [KeptDeck] = []

    /// `nil` takes the launch's own cap.
    init(cap: Int? = nil) {
        self.cap = max(1, cap ?? Self.launchCap)
    }

    /// This reading's deck, made on first sight and moved to the back of the order.
    ///
    /// Touching the order is the whole of the write, which is why a `body` may ask: nothing
    /// observes this store, so nothing re-renders for it — the same arrangement `FeedGeometries`
    /// has, and for the same reason.
    func show(_ reading: FeedReading, opening held: FeedRow.ID? = nil) -> KeptDeck {
        if let found = decks.firstIndex(where: { $0.reading == reading }) {
            decks.append(decks.remove(at: found))
            return decks[decks.count - 1]
        }
        let deck = KeptDeck(of: reading, opening: held)
        decks.append(deck)
        evictLeastRecent()
        return deck
    }

    /// The deck of this reading where one is kept, without touching the order. For the surfaces
    /// that ask ABOUT a deck rather than open it — and for a suite, which must be able to ask
    /// whether a reading was evicted without bringing it back.
    func kept(_ reading: FeedReading) -> KeptDeck? {
        decks.first { $0.reading == reading }
    }

    var count: Int {
        decks.count
    }

    /// Which readings are kept, oldest first.
    var readings: [FeedReading] {
        decks.map(\.reading)
    }

    /// Oldest first, one at a time, until the cap holds. The deck just shown is at the back and so
    /// is never the one dropped.
    private func evictLeastRecent() {
        while decks.count > cap {
            decks.removeFirst().retire()
        }
    }
}

extension EnvironmentValues {
    /// Where the reader's open decks are kept, injected by the one view above every switch that
    /// would otherwise destroy them — see `CockpitView`. `nil` in a preview and in a specimen,
    /// where the surface holds one of its own and nothing switches.
    @Entry var argoFeedDecks: KeptDecks?
}
