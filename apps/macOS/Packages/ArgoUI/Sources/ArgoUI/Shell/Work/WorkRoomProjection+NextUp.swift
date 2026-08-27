import ArgoEngine

extension WorkRoomProjection {
    /// The hero, derived from the same open set the views count. Work happens at leaves, so a
    /// parent is never picked and never counted into the pool that decides a tier.
    ///
    /// The pick itself is the FIRST takeable in the provider's own order. That is not a ranking —
    /// #273 owns which ticket lands here, and replaces this line when it does. Everything else in
    /// this file is the card's own arithmetic and survives that.
    static func nextUp(of open: [WorkItem], reading: WorkReading) -> NextUp {
        guard !open.isEmpty else { return .backlogClear }
        let leaves = open.filter(\.children.isEmpty)
        let unblocked = leaves.filter { $0.blockage == .clear }
        guard !unblocked.isEmpty else { return .nothingUnblocked }
        guard let pick = unblocked.first(where: { !reading.claimed.contains($0.number) }) else {
            return .allRunning
        }
        return .pick(NextUp.Pick(
            id: pick.number, title: pick.title, reasons: reasons(for: pick, in: reading),
        ))
    }

    /// The reasons in the design's order — `high priority` → `unblocked` → `next in <PRD>` — cut to
    /// two. Order is the priority, so the cut always drops the weakest claim rather than a random
    /// one.
    private static func reasons(for pick: WorkItem, in reading: WorkReading) -> [NextUp.Reason] {
        var earned: [NextUp.Reason] = []
        if reading.highPriority.contains(pick.number) {
            earned.append(.highPriority)
        }
        // Only where the provider exposed edges at all. An empty `blockedBy` across every item it
        // served is a provider that has not told us about blockers, not one telling us there are
        // none — so the claim degrades down to silence (`CONTEXT.md` L2 · degrade-down).
        if reading.items.contains(where: { !$0.blockedBy.isEmpty }) {
            earned.append(.unblocked)
        }
        if let chart = chart(holding: pick.number, in: reading) {
            earned.append(.next(chart: chart))
        }
        return Array(earned.prefix(NextUp.chipLimit))
    }

    private static func chart(holding number: Int, in reading: WorkReading) -> String? {
        reading.charts
            .first { parent in
                reading.items.first { $0.number == parent }?.children.contains(number) ?? false
            }
            .map { "#\($0)" }
    }
}

extension NextUp {
    /// At most two chips. A third earns the reader nothing: by the time it is read the first has
    /// already answered "why this one".
    static let chipLimit = 2
}
