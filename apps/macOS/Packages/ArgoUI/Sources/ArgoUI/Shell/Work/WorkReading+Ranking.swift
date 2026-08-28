import ArgoEngine
import Foundation

/// How the hero decides which of the takeable leaves to offer: `priority desc → PRD sequence → age`
/// (#273). Spec-readiness and blocker-criticality are not inputs, and no number is computed.
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
        let place = sequence(of: item.number)
        return Rank(
            rung: item.priorityRung.rung,
            chart: place?.chart ?? .max,
            sequence: place?.child ?? .max,
            age: item.updatedAt.map { Int($0.timeIntervalSince1970) } ?? .max,
            number: item.number,
        )
    }

    /// Which chart holds this ticket and where in it — both indices, and both the PROVIDER's own
    /// author order: the order it served its charts in, which is the order `CHARTS` draws, and the
    /// order it served that chart's `children` in.
    ///
    /// Two indices and not one, so a ticket is never ranked against one in another chart by its
    /// position alone: nobody sequenced two PRDs against each other, but the provider did serve one
    /// before the other, and that is a fact rather than an invention.
    ///
    /// `nil` for a ticket in no chart, which sorts BEHIND every ticket in one: a PRD's sequence is
    /// somebody stating an order, and an unsequenced ticket does not overtake one on a statement
    /// nobody made.
    private func sequence(of number: Int) -> (chart: Int, child: Int)? {
        for (chart, parent) in items.enumerated() where parent.isChartShaped {
            if let child = parent.children.firstIndex(of: number) {
                return (chart, child)
            }
        }
        return nil
    }
}

/// The keys, in the order they decide. A struct rather than a chain of `if`s, so the order the
/// ranking claims to use is one readable line that cannot drift out of the order stated above.
///
/// Every key is an ascending `Int` and every absent one is `.max`, so "unknown sorts last" is said
/// once rather than once per key.
private struct Rank: Comparable {
    /// Rung 0 is `high`. `WorkItemPriority` owns which word is which.
    let rung: Int
    /// Which chart holds the ticket, and where in that chart — the two halves of `PRD sequence`.
    let chart: Int
    let sequence: Int
    /// Whole seconds since the epoch, so the OLDEST sorts first and an unread age sorts last.
    /// Treating a silence as ancient would head a list that sorts by neglect.
    let age: Int
    let number: Int

    static func < (lhs: Rank, rhs: Rank) -> Bool {
        (lhs.rung, lhs.chart, lhs.sequence, lhs.age, lhs.number)
            < (rhs.rung, rhs.chart, rhs.sequence, rhs.age, rhs.number)
    }
}
