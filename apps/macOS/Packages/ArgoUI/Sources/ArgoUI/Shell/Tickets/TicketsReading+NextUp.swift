import ArgoEngine

extension TicketsReading {
    /// The hero, over the same open set the views count. Work happens at leaves, so a parent is
    /// neither picked nor counted into the pool that decides a tier.
    ///
    /// A COLD-START planner, never a best-move-overall recommender: the pool is `open · leaf · todo
    /// · unblocked · session-less`, and the pick is the head of it ranked by `priority desc → PRD
    /// sequence → age` (`TicketsReading+Ranking.swift`). Which ticket most needs attention is a
    /// different question, and the attention channel's.
    func nextUp(of open: [Ticket]) -> NextUp {
        // No open LEAF is the clear tier, not the blocked one: "every open leaf is waiting on
        // something still open" is false when there is no open leaf to wait.
        let leaves = open.filter(\.children.isEmpty)
        guard !leaves.isEmpty else { return .backlogClear }
        // `unread` counts as takeable: a provider that served no edges has not said this ticket is
        // waiting on anything, and refusing to offer it would make an edgeless provider look like a
        // backlog where everything is blocked. The CHIP is what gets suppressed, not the pick.
        let unblocked = leaves.filter { $0.blockage != .blocked && $0.blockage != .stranded }
        guard !unblocked.isEmpty else { return .nothingUnblocked }
        // `todo` and `session-less` in ONE clause: `TicketState.open` is open AND unclaimed, and
        // the claim is the roster join the room already makes.
        let pool = unblocked.filter { $0.state(claimed: claimed.contains($0.number)) == .open }
        guard let pick = ranked(pool).first else { return .allRunning }
        return .pick(NextUp.Pick(
            number: pick.number, title: pick.title, reasons: reasons(for: pick, in: pool),
        ))
    }

    /// `high priority` → `unblocked` → `next in <PRD>`, cut to `chipLimit`, with `oldest untouched`
    /// where none of the three was earned. Order is the priority, so the cut drops the weakest
    /// claim rather than an arbitrary one.
    private func reasons(for pick: Ticket, in pool: [Ticket]) -> [NextUp.Reason] {
        var earned: [NextUp.Reason] = []
        // The same rung the ranking sorted by, so the chip and the pick's place cannot disagree.
        if pick.priorityRung == .high {
            earned.append(.highPriority)
        }
        // Only where THIS ticket's edges were read. Inferring it from the backlog carrying edges
        // somewhere would assert `unblocked` for a pick nobody asked about.
        if pick.blockage != .unread {
            earned.append(.unblocked)
        }
        if let chart = chart(holding: pick.number) {
            earned.append(.next(chart: chart))
        }
        // A FALLBACK, and still checked: the card says why this ticket rather than the rest, so
        // with nothing else earned it names the one input left — and only where that was read.
        if earned.isEmpty, isOldest(pick, in: pool) {
            earned.append(.oldestUntouched)
        }
        return Array(earned.prefix(NextUp.chipLimit))
    }

    /// The PRD-shaped parent this pick hangs under, which is the chip's `next in #607`. The
    /// sidebar no longer lists these (#844); `isChartShaped` is read here and nowhere else.
    ///
    /// Where two charts both claim the pick the LOWER-NUMBERED one names it, on the same tie-break
    /// the backlog tree resolves a contested edge by (#985) — the predicate is this surface's own,
    /// the tie-break is not.
    private func chart(holding number: Int) -> String? {
        Ticket.oldestFirst(items)
            .first { $0.isChartShaped && $0.children.contains(number) }
            .map { "#\($0.number)" }
    }
}
