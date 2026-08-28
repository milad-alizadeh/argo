import ArgoEngine

/// #334's **remaining depth**: for one open ticket, how many closures stand between it and the NOW
/// line.
///
/// ```
/// rd(n) = openBlockers(n).length === 0
///           ? 0
///           : 1 + max(rd(b) for b in openBlockers(n))
/// ```
///
/// An open blocker is one whose closure does not SATISFY the edge, which is a wider set than "still
/// open": a ruled-out blocker never closes, so it keeps its dependent ahead of the line rather than
/// clearing it (`WorkItemClosure.satisfiesBlocker`). #338 is what says so out loud in red; this
/// only refuses to call the dependent takeable.
///
/// Memoized, and CYCLE-GUARDED: a ticket already on the walk resolves to `0` rather than recursing,
/// so a charting mistake costs a wrong column and never a hung render.
///
/// A blocker the poll never reached resolves to `0` too, and so does a ticket whose provider served
/// no edges at all — an unknown distance degrades DOWN to the nearest column rather than inventing
/// one (`CONTEXT.md` L2 · degrade-down). That is also the whole of the no-dependency degradation:
/// with nothing served, every open child answers `0` and the route collapses to one takeable
/// column.
struct RouteDepth {
    private let items: [Int: WorkItem]
    private var memo: [Int: Int] = [:]
    /// The tickets on the current walk. A struct field rather than a parameter, so the guard holds
    /// across the whole traversal instead of one branch of it.
    private var walking: Set<Int> = []

    init(items: [Int: WorkItem]) {
        self.items = items
    }

    mutating func remaining(of number: Int) -> Int {
        if let known = memo[number] {
            return known
        }
        guard let item = items[number], !walking.contains(number) else { return 0 }

        walking.insert(number)
        var deepest = 0
        var blocked = false
        for blocker in item.blockedBy ?? [] where !blocker.closure.satisfiesBlocker {
            blocked = true
            deepest = max(deepest, remaining(of: blocker.number))
        }
        walking.remove(number)

        let answer = blocked ? deepest + 1 : 0
        memo[number] = answer
        return answer
    }
}
