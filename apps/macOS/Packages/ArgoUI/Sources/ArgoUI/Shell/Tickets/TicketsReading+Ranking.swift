import ArgoEngine
import Foundation

/// How the hero decides which of the takeable leaves to offer: `priority desc → in-flight conflict
/// → PRD sequence → age` (#273, #1384). Spec-readiness and blocker-criticality are not inputs, and
/// no number is computed.
extension TicketsReading {
    /// The pool in rank order. A total order, so the same listing always yields the same pick: the
    /// number is the last key, and it breaks the tie the four ranking inputs left rather than
    /// ranking anything itself.
    @MainActor
    func ranked(_ pool: [Ticket]) -> [Ticket] {
        guard !pool.isEmpty else { return [] }
        let places = TicketChartPlaces(of: items)
        let conflicted = inFlightCharts(in: places)
        return pool
            .map { (item: $0, rank: rank(of: $0, in: places, conflicted: conflicted)) }
            .sorted { $0.rank < $1.rank }
            .map(\.item)
    }

    /// Whether this ticket is the pool's most neglected — the fallback claim, checked rather than
    /// assumed. False for a ticket nobody read a timestamp for: no age was read, so `oldest` is not
    /// a thing anybody may say about it (`CONTEXT.md` L2 · degrade-down).
    func isOldest(_ item: Ticket, in pool: [Ticket]) -> Bool {
        guard let touched = item.updatedAt else { return false }
        return pool.compactMap(\.updatedAt).allSatisfy { touched <= $0 }
    }

    /// The charts a currently-claimed ticket sits in — the cheap proxy for what a running Session's
    /// own work already touches (#1384). Empty wherever no claimed ticket sits in a chart, which is
    /// not the same as having read zero conflict — it is nothing to compare against.
    @MainActor
    func inFlightCharts(in places: TicketChartPlaces) -> Set<Int> {
        Set(claims.numbers.compactMap { places.place(of: $0)?.chart })
    }

    /// Whether this candidate's own chart is known and sits outside every in-flight one — the
    /// chip's own read of the same input the rank below takes. False, and never asserted, for a
    /// candidate in no chart or where nothing is in flight to compare against: an absent chart is
    /// not a claim of zero overlap (`CONTEXT.md` L2 · degrade-down).
    @MainActor
    func isLowConflict(_ item: Ticket, in places: TicketChartPlaces, conflicted: Set<Int>) -> Bool {
        guard !conflicted.isEmpty, let chart = places.place(of: item.number)?.chart else {
            return false
        }
        return !conflicted.contains(chart)
    }

    @MainActor
    private func rank(of item: Ticket, in places: TicketChartPlaces, conflicted: Set<Int>) -> Rank {
        let place = places.place(of: item.number)
        return Rank(
            rung: item.priorityRung.rung,
            conflict: place.map(\.chart).map(conflicted.contains) == true ? 1 : 0,
            chart: place?.chart ?? .max,
            sequence: place?.child ?? .max,
            age: item.updatedAt.map { Int($0.timeIntervalSince1970) } ?? .max,
            number: item.number,
        )
    }
}

/// The keys, in the order they decide. A struct rather than a chain of `if`s, so the order the
/// ranking claims to use is one readable line that cannot drift out of the order stated above.
///
/// Every key is an ascending `Int` and every absent one is `.max` (or, for `conflict`, `0` — the
/// unknown reads the same as the confirmed-clear, never as the confirmed-conflicting), so "unknown
/// sorts last" is said once per key rather than invented per case.
private struct Rank: Comparable {
    /// Rung 0 is `high`. `TicketPriority` owns which word is which.
    let rung: Int
    /// `1` where this ticket's own chart is one a claimed ticket already sits in, `0` otherwise —
    /// which is also the honest default where nothing was read either way (#1384). Ranked ahead of
    /// the PRD sequence: a chart position is a statement about ONE PRD's order, and a running
    /// Session's footprint is a fresher fact than that statement, but never fresher than priority.
    let conflict: Int
    /// Which chart holds the ticket, and where in that chart — the two halves of `PRD sequence`.
    let chart: Int
    let sequence: Int
    /// Whole seconds since the epoch, so the OLDEST sorts first and an unread age sorts last.
    /// Treating a silence as ancient would head a list that sorts by neglect.
    let age: Int
    let number: Int

    static func < (lhs: Rank, rhs: Rank) -> Bool {
        (lhs.rung, lhs.conflict, lhs.chart, lhs.sequence, lhs.age, lhs.number)
            < (rhs.rung, rhs.conflict, rhs.chart, rhs.sequence, rhs.age, rhs.number)
    }
}
