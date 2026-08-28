import ArgoEngine
import Foundation

/// How the hero decides which of the takeable leaves to offer: `priority desc → PRD sequence → age`
/// (#273), and nothing else.
///
/// **Dumb and legible on purpose.** Spec-readiness and blocker-criticality are deliberately not
/// inputs, and no number is computed anywhere — the order is reproducible by hand from the three
/// facts the room already draws, which is what lets a reader disagree with the pick rather than
/// merely distrust it.
extension WorkReading {
    /// The pool in rank order. A total order, so the same listing always yields the same pick: the
    /// number is the last key, and it breaks the tie the three ranking inputs left rather than
    /// ranking anything itself.
    func ranked(_ pool: [WorkItem]) -> [WorkItem] {
        pool
            .map { (item: $0, rank: rank(of: $0)) }
            .sorted { $0.rank < $1.rank }
            .map(\.item)
    }

    /// Whether this ticket is the pool's most neglected — the fallback claim, checked rather than
    /// assumed. False for a ticket nobody read a timestamp for: no age was read, so `oldest` is not
    /// a thing anybody may say about it (`CONTEXT.md` L2 · degrade-down).
    func isOldest(_ item: WorkItem, in pool: [WorkItem]) -> Bool {
        guard let touched = item.updatedAt else { return false }
        return pool.compactMap(\.updatedAt).allSatisfy { touched <= $0 }
    }

    private func rank(of item: WorkItem) -> Rank {
        Rank(
            rung: item.priorityRung.rung,
            sequence: sequence(of: item.number),
            age: item.updatedAt?.timeIntervalSince1970 ?? .greatestFiniteMagnitude,
            number: item.number,
        )
    }

    /// Where a chart placed this ticket among its children — `children` is the provider's own
    /// author order, which every provider serves natively, and that order IS the PRD's sequence.
    ///
    /// A ticket in no chart sorts BEHIND every ticket in one: a PRD's sequence is somebody stating
    /// an order, and a ticket nobody sequenced does not overtake one on a statement nobody made.
    private func sequence(of number: Int) -> Int {
        for parent in items where parent.isChartShaped {
            if let place = parent.children.firstIndex(of: number) {
                return place
            }
        }
        return .max
    }
}

/// The four keys, in the order they decide. A struct rather than a chain of `if`s, so the order the
/// ranking claims to use is one readable line that cannot drift out of the order stated above.
private struct Rank: Comparable {
    /// Ascending, so rung 0 — `high` — comes first. `WorkItemPriority` owns which word is which.
    let rung: Int
    let sequence: Int
    /// Seconds since the epoch, so the OLDEST sorts first. A ticket nobody read a timestamp for
    /// sorts last: absent is not an age, and treating a silence as ancient would put the
    /// least-known
    /// ticket at the head of the list.
    let age: TimeInterval
    let number: Int

    static func < (lhs: Rank, rhs: Rank) -> Bool {
        (lhs.rung, lhs.sequence, lhs.age, lhs.number)
            < (rhs.rung, rhs.sequence, rhs.age, rhs.number)
    }
}
