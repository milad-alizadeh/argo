import ArgoEngine

extension WorkReading {
    /// The hero, over the same open set the views count. Work happens at leaves, so a parent is
    /// neither picked nor counted into the pool that decides a tier.
    ///
    /// The pick is the first takeable leaf in the provider's own order, which is not a ranking —
    /// #273 owns which ticket lands here and replaces that line when it does.
    func nextUp(of open: [WorkItem]) -> NextUp {
        // No open LEAF is the clear tier, not the blocked one: "every open leaf is waiting on
        // something still open" is false when there is no open leaf to wait.
        let leaves = open.filter(\.children.isEmpty)
        guard !leaves.isEmpty else { return .backlogClear }
        let unblocked = leaves.filter { $0.blockage == .clear }
        guard !unblocked.isEmpty else { return .nothingUnblocked }
        guard let pick = unblocked.first(where: { !claimed.contains($0.number) }) else {
            return .allRunning
        }
        return .pick(NextUp.Pick(
            number: pick.number, title: pick.title, reasons: reasons(for: pick),
        ))
    }

    /// `high priority` → `unblocked` → `next in <PRD>`, cut to `chipLimit`. Order is the priority,
    /// so the cut drops the weakest claim rather than an arbitrary one.
    private func reasons(for pick: WorkItem) -> [NextUp.Reason] {
        var earned: [NextUp.Reason] = []
        if highPriority.contains(pick.number) {
            earned.append(.highPriority)
        }
        // Only where THIS ticket's edges were read. Inferring it from the backlog carrying edges
        // somewhere would assert `unblocked` for a pick nobody asked about.
        if edgesRead.contains(pick.number) {
            earned.append(.unblocked)
        }
        if let chart = chart(holding: pick.number) {
            earned.append(.next(chart: chart))
        }
        return Array(earned.prefix(NextUp.chipLimit))
    }

    private func chart(holding number: Int) -> String? {
        charts
            .first { parent in
                items.first { $0.number == parent }?.children.contains(number) ?? false
            }
            .map { "#\($0)" }
    }
}
