import ArgoEngine

/// #334's remaining depth: for one open ticket, how many closures stand between it and the NOW
/// line.
///
/// ```
/// rd(n) = openBlockers(n).length === 0
///           ? 0
///           : 1 + max(rd(b) for b in openBlockers(n))
/// ```
///
/// An open blocker is one whose closure does not satisfy the edge, which is wider than "still
/// open": `WorkItemClosure.satisfiesBlocker` refuses a ruled-out blocker, so such an edge never
/// clears.
///
/// A blocker outside the listing resolves to `0`, and so does a ticket whose provider served no
/// edges — an unknown distance degrades down (`CONTEXT.md` L2 · degrade-down).
struct RouteDepth {
    private let items: [Int: WorkItem]
    private var memo: [Int: Int] = [:]
    private var walking: Set<Int> = []

    init(items: [Int: WorkItem]) {
        self.items = items
    }

    mutating func remaining(of number: Int) -> Int {
        walk(number).depth
    }

    /// `guarded` is true when the answer came through a cycle, and it is why the memo is written
    /// conditionally: the `0` the guard returns is a fiction, so caching a depth derived from it
    /// leaves the column of a ticket OUTSIDE the ring depending on the order its siblings were
    /// charted in.
    private mutating func walk(_ number: Int) -> (depth: Int, guarded: Bool) {
        if let known = memo[number] {
            return (known, false)
        }
        guard let item = items[number] else { return (0, false) }
        guard !walking.contains(number) else { return (0, true) }

        walking.insert(number)
        var deepest = 0
        var blocked = false
        var guarded = false
        for blocker in item.blockedBy ?? [] where !blocker.closure.satisfiesBlocker {
            blocked = true
            let step = walk(blocker.number)
            deepest = max(deepest, step.depth)
            guarded = guarded || step.guarded
        }
        walking.remove(number)

        let answer = blocked ? deepest + 1 : 0
        if !guarded {
            memo[number] = answer
        }
        return (answer, guarded)
    }
}
