import ArgoEngine

extension WorkView {
    /// Whether this view holds an open Work Item. ONE predicate, used both to count a view in the
    /// sidebar and to fill the list beside it — the two asking the same question separately is how
    /// a rail comes to disagree with the rows it sits next to.
    ///
    /// `unblocked` and `blocked` are exact complements over the tickets whose edges were READ, so
    /// they partition that set; only `WorkItemBlockage.clear` is unblocked, which puts a STRANDED
    /// item — its blocker ruled out, so the edge never satisfies — on the blocked side rather than
    /// between the two.
    ///
    /// A ticket whose edges nobody served is in NEITHER (#820). An empty `blockedBy` cannot tell a
    /// provider that answered "none" from one that was never asked, so a provider exposing no
    /// dependency edges leaves both views reading zero rather than having one of them assert the
    /// whole backlog is clear (`CONTEXT.md` L2 · degrade-down).
    func admits(_ item: WorkItem, claimed: Bool) -> Bool {
        switch self {
        case .allOpen: true
        case .unblocked: item.blockersRead && item.blockage == .clear
        case .inProgress: claimed
        case .blocked: item.blockersRead && item.blockage != .clear
        }
    }
}
