/// The order the sidebar PUBLISHES, which is the activity order held still while somebody is
/// reading it.
///
/// The Hub's ordering stays what it is — newest activity first — and this holds a snapshot of it
/// rather than re-sorting.
///
/// Holding is not stopping. A held order still admits Sessions that arrive and drops the ones
/// that end; what it refuses is a SWAP — two rows trading places under the pointer.
struct RosterOrder: Equatable, Sendable {
    /// The ids in the order that was on screen when the reader arrived. `nil` while nothing holds
    /// it, which is when the activity order simply IS the published one.
    private var held: [String]?

    var isHolding: Bool {
        held != nil
    }

    /// Takes the freeze at the order on screen now. Idempotent: engagement is reported by more than
    /// one signal, and re-snapshotting would let one reshuffle through per signal.
    mutating func hold(_ ids: [String]) {
        guard held == nil else { return }
        held = ids
    }

    mutating func release() {
        held = nil
    }

    /// Records the membership a held order has already absorbed. Without this a newly admitted row
    /// is re-placed from scratch on every publish, against an activity order that keeps moving.
    mutating func admit(_ ids: [String]) {
        guard held != nil else { return }
        held = merged(ids)
    }

    func published(_ ids: [String]) -> [String] {
        held == nil ? ids : merged(ids)
    }

    /// The same answer over rows, so the view never keeps an id-to-row lookup of its own.
    func published<Row: Identifiable>(_ rows: [Row]) -> [Row] where Row.ID == String {
        guard isHolding else { return rows }
        let byID = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return published(rows.map(\.id)).compactMap { byID[$0] }
    }

    /// The held order minus what has gone, plus what has arrived — each new id at the place the
    /// activity order puts it, relative to the rows the walk has already reached.
    ///
    /// Where the activity order and the held order disagree, the held rows win: a new id goes
    /// BELOW every row already walked past rather than in between two of them. That can put a
    /// Session that arrives behind a row which has just spoken lower than its activity alone would
    /// — the price of the one thing the hold owes the reader, which is that no row already on the
    /// roster moves (#1236).
    private func merged(_ ids: [String]) -> [String] {
        guard let held else { return ids }
        let present = Set(ids)
        var order = held.filter(present.contains)
        var placed = Set(order)
        // How far down the PUBLISHED order the walk has reached, which is where the next new id
        // goes. It only ever moves down: the activity order of the held rows moves under the walk,
        // and a new id placed from a step that walked back up would wedge in between two rows that
        // were next to each other — the swap the hold exists to refuse (#1236).
        var frontier: Int?
        for id in ids {
            if placed.contains(id) {
                if let reached = order.firstIndex(of: id) {
                    // Nothing walked yet is the top, which no index is above.
                    frontier = max(frontier ?? 0, reached)
                }
                continue
            }
            let place = frontier.map { $0 + 1 } ?? 0
            order.insert(id, at: place)
            placed.insert(id)
            frontier = place
        }
        return order
    }
}
