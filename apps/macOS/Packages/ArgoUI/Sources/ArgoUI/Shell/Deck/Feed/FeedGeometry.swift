import AppKit
import SwiftUI

/// Measured row heights for ONE reading, held above every view identity a switch destroys.
///
/// Which reading's heights these are is `FeedGeometries`', which holds one of these per
/// `FeedReading`.
///
/// A height is a full SwiftUI layout against the ruler — see `FeedTableCoordinator.measuredHeight`
/// — and `InstrumentDeckShell` draws each room in its own `switch` arm, so leaving the Sessions
/// room tears the table down and coming back measured every row again (#858).
///
/// Each height is filed UNDER the whole of what it is a fact about — `Ground` is the key, not a
/// guard on a key. That is the entire correctness of outliving the table: there is no invalidation
/// to get right and no order to get right, because a height that is no longer true of anything
/// simply stops being found. It is also what makes a height outlive its row's INDEX: a Session is
/// drawn from a bounded excerpt first and from the whole file a moment later
/// (`TranscriptExcerpt`), which re-numbers every row the excerpt already had, and keyed by index
/// every one of those heights was thrown away and measured again for rows whose bytes had not
/// moved.
///
/// What a height depends on splits in two, and so does this. The width and the ink are the same for
/// every row of a pass, so they are the store's and are checked once — `settle(at:in:)`. Everything
/// that differs per row is the `Ground` the question comes in with. Keeping the pass facts out of
/// `Ground` is not tidiness: a ground is built for EVERY row each time the minimap re-reads the
/// document, and a `FeedCellEnvironment` carries a palette and two closures.
///
/// NOT `@Observable`. A height is written per measured row, and a view invalidated at that rate
/// would cost more than the measuring does.
@MainActor final class FeedGeometry {
    private var held: [Ground: Held] = [:]
    private var width: CGFloat?
    private var ink: FeedCellEnvironment.Ink?
    /// How long the reading on screen is, which is how many heights may be kept — see
    /// `hold(rows:)`.
    private var rows = 0
    /// Monotonic, and stamped on every hit as well as on every write, so eviction can name the
    /// least recently ASKED-FOR entry rather than merely the oldest one.
    private var uses = 0

    var count: Int {
        held.count
    }

    var isEmpty: Bool {
        held.isEmpty
    }

    /// The pass's own facts, checked once for the whole reading. A width or an ink nothing was
    /// measured under retires every height, because not one of them is true of it.
    func settle(at width: CGFloat, in ink: FeedCellEnvironment) {
        guard self.width != width || self.ink != ink.ink else { return }
        held.removeAll()
        self.width = width
        self.ink = ink.ink
    }

    func height(under ground: Ground) -> CGFloat? {
        guard let at = held.index(forKey: ground) else { return nil }
        let height = held[at].value.height
        uses += 1
        held.values[at].usedAt = uses
        return height
    }

    func record(_ height: CGFloat, under ground: Ground) {
        uses += 1
        held[ground] = Held(height: height, usedAt: uses)
        evict()
    }

    /// Measured heights surrendered — all of them, or the grounds named.
    func drop(_ grounds: [Ground]? = nil) {
        guard let grounds else { return held.removeAll() }
        for ground in grounds {
            held[ground] = nil
        }
    }

    /// How long the reading is, which is how many heights may be held — the ceiling ADR-0028
    /// Rule 4 asks to derive from the DOCUMENT rather than from a literal.
    ///
    /// A ground answers for its own row or for nothing, so a height that stopped being true stops
    /// being found rather than being deleted — and would then be held for the life of the window.
    /// That is what needs a ceiling: a live transcript rewrites its last row as the call in it is
    /// answered, and every version nobody will ask for again is one of these entries.
    ///
    /// Twice the reading and never more, cut back to the reading itself: a Session with ten rows
    /// cannot go on holding the previous one's four hundred, and the room in between is what keeps
    /// a re-write from evicting a height the same pass is about to ask for. At exactly one per row
    /// a single rewritten row puts the store one over, the eviction takes the least recently used
    /// height — which is a row at the top of the document, not the orphan — and re-measuring THAT
    /// row puts it one over again: a whole-document re-measure walked out of a one-row rewrite.
    /// `FeedRemeasureCostTests` reads 57 measurements against its 2 with the headroom taken away.
    ///
    /// Least recently ASKED-FOR goes first, which is what makes an orphan the entry that leaves:
    /// every height still true of a row on screen is touched by the next whole-document walk, and
    /// an orphan is touched by nothing.
    func hold(rows: Int) {
        self.rows = rows
        evict()
    }

    private func evict() {
        guard held.count > rows * 2 else { return }
        let kept = held.sorted { $0.value.usedAt > $1.value.usedAt }.prefix(rows)
        held = Dictionary(uniqueKeysWithValues: kept.map { ($0.key, $0.value) })
    }

    private struct Held {
        let height: CGFloat
        var usedAt: Int
    }
}
