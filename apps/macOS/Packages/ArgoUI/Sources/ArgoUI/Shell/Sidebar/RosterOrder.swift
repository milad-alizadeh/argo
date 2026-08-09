/// The order the sidebar PUBLISHES, which is the activity order held still while somebody is
/// reading it.
///
/// The Hub's ordering stays what it is — newest activity first, the honest "what moved last"
/// signal — and this holds a snapshot of it rather than re-sorting: "is the reader looking at
/// this" is a UI fact the engine has no business knowing, and a second sort here would be a
/// second opinion about what newest means.
///
/// Holding is not stopping. A held order still admits Sessions that arrive and drops the ones
/// that end; what it refuses is a SWAP — two rows trading places under a pointer that is already
/// on one of them.
struct RosterOrder: Equatable, Sendable {
    /// The ids in the order that was on screen when the reader arrived. `nil` while nothing holds
    /// it, which is when the activity order simply IS the published one.
    private var held: [String]?

    var isHolding: Bool {
        held != nil
    }

    /// Takes the freeze at the order on screen now. Idempotent on purpose: engagement is reported
    /// by more than one signal, and a second arrival must not re-snapshot an order the first is
    /// already holding still — that would let one reshuffle through per signal.
    mutating func hold(_ ids: [String]) {
        guard held == nil else { return }
        held = ids
    }

    mutating func release() {
        held = nil
    }

    /// Records the membership a held order has already absorbed.
    ///
    /// Without this a newly admitted row is re-placed from scratch on every publish, and its
    /// place is derived from an activity order that keeps moving — so the one row the freeze let
    /// in would be the one row that drifts. Nothing to record when unheld.
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
    /// activity order puts it, never appended at the end. A Session that starts while the order is
    /// held is the newest thing there is, and a roster that showed it last would be answering a
    /// different question from the one the sort key asks.
    private func merged(_ ids: [String]) -> [String] {
        guard let held else { return ids }
        let present = Set(ids)
        var order = held.filter(present.contains)
        var placed = Set(order)
        // The last id walked past, which is what a new one is placed AFTER: its position in the
        // activity order is only meaningful relative to the rows that were already there.
        var anchor: String?
        for id in ids {
            if !placed.contains(id) {
                order.insert(
                    id,
                    at: anchor.flatMap { order.firstIndex(of: $0).map { $0 + 1 } } ?? 0,
                )
                placed.insert(id)
            }
            anchor = id
        }
        return order
    }
}
