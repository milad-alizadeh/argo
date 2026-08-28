import ArgoEngine
@testable import ArgoUI
import Testing

/// Where the Route PUTS each child of a parent (#334, #335).
///
/// Placement is a pure function of children plus blocking edges, so it is tested as one: feed it a
/// set of tickets, assert the zone and the column each one lands in. No view is mounted and nothing
/// is snapshotted — a test that rendered the canvas would be asserting SwiftUI's layout, and the
/// one thing this ticket computes is the geometry the canvas is handed.
@Suite("The Route places a parent's children")
struct WorkRoutePlacementTests {
    /// The mid-flight parent the design's own Route is drawn over: #607, nine children, of which
    /// two are closed, three takeable and two blocked at different distances.
    @Test
    func `the three zones fall out of closure and remaining depth`() throws {
        let route = try #require(WorkFixture.chartRoom.chart?.route)

        #expect(route.stops(in: .behind).map(\.id) == [690, 745])
        #expect(route.stops(in: .now).map(\.id) == [609, 388, 273])
        #expect(route.stops(in: .ahead).map(\.id) == [272, 334])
    }

    /// One column right means one closure away. #272 waits on #609 and #388, both takeable, so it
    /// is one; #334 waits on #272, so it is two.
    @Test
    func `an ahead column is the number of closures still to come`() throws {
        let route = try #require(WorkFixture.chartRoom.chart?.route)

        #expect(column(of: 272, in: route) == 1)
        #expect(column(of: 334, in: route) == 2)
        #expect(route.reach == 2)
    }

    /// Behind the line and on it are both column zero. The zone is what tells them apart, so a
    /// canvas cannot draw closed work in the takeable column by reading the number alone.
    @Test
    func `behind the line and on it are both column zero`() throws {
        let route = try #require(WorkFixture.chartRoom.chart?.route)

        #expect(route.stops(in: .behind).allSatisfy { $0.column == 0 })
        #expect(route.stops(in: .now).allSatisfy { $0.column == 0 })
    }

    /// Rows are counted per column, in charted order, and the two sides of the line are counted
    /// APART: two closed children and three takeable ones both start at row zero.
    @Test
    func `each column stacks from zero in charted order`() throws {
        let route = try #require(WorkFixture.chartRoom.chart?.route)

        #expect(route.stops(in: .behind).map(\.row) == [0, 1])
        #expect(route.stops(in: .now).map(\.row) == [0, 1, 2])
        #expect(route.stops(in: .ahead).map(\.row) == [0, 0])
    }

    /// Day one: every open child waits on something, so NOTHING is takeable and the line stands at
    /// the left wall with all of the work ahead of it. The state that must not read as finished.
    @Test
    func `a parent on day one has an empty line and everything ahead`() throws {
        let route = try #require(WorkFixture.dayOneChartRoom.chart?.route)

        #expect(route.stops(in: .now).isEmpty)
        #expect(route.stops(in: .ahead).count == 5)
        #expect(route.stops(in: .behind).map(\.id) == [690, 745])
    }

    /// The same parent finished: the line has walked past all of the work, and every stop is behind
    /// it. Nothing on the line and nothing ahead.
    @Test
    func `a resolved parent has every stop behind the line`() throws {
        let route = try #require(WorkFixture.resolvedChartRoom.chart?.route)

        #expect(route.stops(in: .now).isEmpty)
        #expect(route.stops(in: .ahead).isEmpty)
        #expect(route.stops(in: .behind).count == route.stops.count)
        #expect(route.reach == 0)
    }

    @Test
    func `a single-child parent renders one stop`() throws {
        let parent = Self.node(1, children: [2])
        let route = try #require(
            WorkRoomProjection.route(of: parent, among: [parent, Self.node(2)]),
        )

        #expect(route.stops.map(\.id) == [2])
        #expect(route.stops.first?.zone == .now)
        #expect(route.reach == 0)
    }

    /// A parent whose children the poll has not reached has no Route at all. The tree is the honest
    /// presentation of it — an axis with nothing on it reads as finished work.
    @Test
    func `a parent with no children read has no route`() {
        let parent = Self.node(1, children: [2, 3])

        #expect(WorkRoomProjection.route(of: parent, among: [parent]) == nil)
    }

    private func column(of number: Int, in route: WorkRoomProjection.Route) -> Int? {
        route.stops.first { $0.id == number }?.column
    }

    /// A ticket for a placement fixture. Titles ARE the numbers: what the Route reads of a child is
    /// its closure, its edges and its own words, and prose titles would only make the expectations
    /// longer to read.
    static func node(
        _ number: Int,
        blockedBy: [WorkItemBlocker] = [],
        children: [Int] = [],
    )
        -> WorkItem {
        WorkItem(
            number: number,
            title: "#\(number)",
            status: "Todo",
            closure: .open,
            children: children,
            blockedBy: blockedBy,
        )
    }
}
