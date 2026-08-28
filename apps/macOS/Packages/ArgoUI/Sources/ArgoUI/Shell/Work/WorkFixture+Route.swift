import ArgoEngine

/// The chart-scoped readings the Route's renders and previews are shot from (#335).
///
/// The chart is #607, the same parent `deep.png` opens on and the same one the design study's own
/// Route draws — so the map and the tree beside it are two presentations of one real set of tickets
/// rather than two fixtures that happen to agree.
extension WorkFixture {
    /// The chart the Route is read over.
    static let chart = 607

    /// The room scoped to that chart, mid-flight: two children closed behind the line, three
    /// takeable on it, and two ahead in the columns their blockers put them in.
    static let chartRoom = WorkRoomProjection.room(from: reading, chart: chart)

    /// A chart on DAY ONE — every open child blocked, so the line stands at the left wall with all
    /// of the work ahead of it. The one state a progress axis has to survive without reading as
    /// finished.
    static let dayOneChartRoom = WorkRoomProjection.room(from: reading(of: dayOne), chart: chart)

    /// The same chart FINISHED: the line has walked past all of the work and there is nothing on it
    /// or ahead of it.
    static let resolvedChartRoom = WorkRoomProjection
        .room(from: reading(of: items.map(resolved)), chart: chart)

    /// The same chart over a provider that exposes NO dependency edges. Every open child answers an
    /// unknown distance, which degrades down to the nearest column — so the whole route collapses
    /// to one takeable column and still renders (`edgeless.png`'s provider, on the axis).
    static let edgelessChartRoom = WorkRoomProjection.room(from: edgeless, chart: chart)

    /// Every open child of the chart blocked behind ONE open ticket outside it — which is what a
    /// parent looks like the day it is charted, and the only honest way to reach an empty line: a
    /// DAG always has a source, so blocking the children behind each other would leave one
    /// takeable.
    private static let dayOne: [WorkItem] = items.map { item in
        guard item.closure == .open, chartChildren.contains(item.number) else { return item }
        return WorkItem(copying: item, blockedBy: [WorkItemBlocker(number: gate, closure: .open)])
    }

    /// The ticket every child waits on. Open, and NOT one of them.
    private static let gate = 763

    private static let chartChildren = Set(
        items.first { $0.number == chart }?.children ?? [],
    )
}
