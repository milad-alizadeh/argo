import ArgoEngine

extension WorkView {
    /// Whether this view holds an open Work Item. ONE predicate, used both to count a view in the
    /// sidebar and to fill the list beside it — the two asking the same question separately is how
    /// a rail comes to disagree with the rows it sits next to.
    ///
    /// `unblocked` and `blocked` are exact complements, so they partition the open set; only
    /// `WorkItemBlockage.clear` is unblocked, which puts a STRANDED item — its blocker ruled out,
    /// so the edge never satisfies — on the blocked side rather than between the two.
    func admits(_ item: WorkItem, claimed: Bool) -> Bool {
        switch self {
        case .allOpen: true
        case .unblocked: item.blockage == .clear
        case .inProgress: claimed
        case .blocked: item.blockage != .clear
        }
    }
}
