import ArgoEngine

/// The chart-scoped readings the Route's renders and previews are shot from (#335). The chart is
/// #607 — the parent `deep.png` opens on — so the map and the tree beside it are two presentations
/// of one real set of tickets.
extension WorkFixture {
    static let chart = 607

    /// Mid-flight: two children closed behind the line, three takeable on it, two ahead.
    static let chartRoom = WorkRoomProjection.room(from: reading, chart: chart)

    /// Day one — every open child blocked, so nothing is takeable and the line stands at the left
    /// wall.
    static let dayOneChartRoom = WorkRoomProjection.room(from: reading(of: dayOne), chart: chart)

    /// Finished: the line has walked past all of the work.
    static let resolvedChartRoom = WorkRoomProjection
        .room(from: reading(of: items.map(resolved)), chart: chart)

    /// A provider that serves no dependency edges at all. Every open child answers an unknown
    /// distance, which degrades down, so the route collapses to one takeable column.
    static let edgelessChartRoom = WorkRoomProjection.room(from: edgeless, chart: chart)

    /// More closed children than one column holds, so the closed band wraps (#334 — closed work is
    /// a list, not a graph). Unreachable from the twelve-ticket fixture.
    static let longTailChartRoom = WorkRoomProjection
        .room(from: reading(of: longTail), chart: longTailChart)

    private static let longTailChart = 800

    /// Every open child of the chart blocked behind one open ticket OUTSIDE it. A DAG always has a
    /// source, so blocking the children behind each other would leave one of them takeable.
    private static let dayOne: [WorkItem] = items.map { item in
        guard item.closure == .open, chartChildren.contains(item.number) else { return item }
        return WorkItem(copying: item, blockedBy: [WorkItemBlocker(number: gate, closure: .open)])
    }

    /// The ticket every child waits on: open, and not one of them.
    private static let gate = 763

    private static let chartChildren = Set(
        items.first { $0.number == chart }?.children ?? [],
    )

    private static let longTail: [WorkItem] = {
        let closed = (1 ... ArgoRoute.behindRowCap + 3).map { step in
            WorkItem(
                number: 810 + step,
                title: "A shipped step, number \(step)",
                status: "Done",
                closure: .resolved,
                blockedBy: [],
            )
        }
        let takeable = WorkItem(
            number: 809, title: "What is left to do", status: "Todo", closure: .open, blockedBy: [],
        )
        let parent = WorkItem(
            number: longTailChart,
            title: "A chart most of the way through its work",
            status: "In progress",
            closure: .open,
            type: "PRD",
            children: [takeable.number] + closed.map(\.number),
            blockedBy: [],
        )
        return [parent, takeable] + closed
    }()
}
