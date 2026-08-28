import ArgoEngine
@testable import ArgoUI
import Testing

/// Where the canvas draws what placement decided (#335).
///
/// The one thing it must get right that placement cannot is that the NOW line's position IS the
/// progress bar: it stands at the left wall with nothing closed, and walks right as closed work
/// accumulates behind it.
///
/// Every `CGFloat` equality is settled OUTSIDE the macro, for the reason `SurfaceMeasureTests`
/// records: `#expect` reports a `CGFloat` against a locally summed `CGFloat` as unequal where the
/// two are bit-identical.
@Suite("The Route's canvas measures itself")
struct WorkRouteGeometryTests {
    /// #334: "At the start it stands at the left wall with everything ahead of it."
    @Test
    func `with nothing closed the line stands at the left wall`() throws {
        let geometry = try RouteGeometry(route: route(closed: 0, takeable: 2))
        let atTheWall = geometry.nowLineX == ArgoRoute.originX - ArgoRoute.nowLineLead

        #expect(geometry.behindColumns == 0)
        #expect(atTheWall)
    }

    /// Closed work is drawn as a list, so it wraps into a second quiet column at the row cap rather
    /// than growing one column past the height of the canvas.
    @Test
    func `closed work wraps into a second column at the row cap`() throws {
        let oneColumn = try RouteGeometry(route: route(closed: ArgoRoute.behindRowCap, takeable: 1))
        let twoColumns = try RouteGeometry(
            route: route(closed: ArgoRoute.behindRowCap + 1, takeable: 1),
        )

        #expect(oneColumn.behindColumns == 1)
        #expect(twoColumns.behindColumns == 2)
    }

    /// The line moves right with the work behind it, which is what makes its position the progress
    /// bar rather than a frame the dots sit in.
    @Test
    func `the line walks right as closed work accumulates`() throws {
        let early = try RouteGeometry(route: route(closed: 1, takeable: 1))
        let later = try RouteGeometry(route: route(closed: ArgoRoute.behindRowCap + 1, takeable: 1))
        let movedOneColumn = later.nowLineX - early.nowLineX == ArgoRoute.columnStep

        #expect(movedOneColumn)
    }

    /// A behind stop's row wraps with its column, so the two closed columns start on one vertical.
    @Test
    func `a wrapped closed column starts back at the top row`() throws {
        let geometry = try RouteGeometry(
            route: route(closed: ArgoRoute.behindRowCap + 1, takeable: 1),
        )
        let behind = try #require(geometry.route.stops(in: .behind).last)
        let backAtTheTop = geometry.y(of: behind) == ArgoRoute.originY
        let inTheSecondColumn = geometry.x(of: behind) == ArgoRoute.originX + ArgoRoute.columnStep

        #expect(backAtTheTop)
        #expect(inTheSecondColumn)
    }

    /// An ahead stop sits its own remaining depth beyond the takeable column, wherever the line is.
    @Test
    func `an ahead stop sits its column beyond the line`() throws {
        let geometry = try RouteGeometry(route: route(closed: 1, takeable: 1, blocked: 2))
        let deepest = try #require(geometry.route.stops(in: .ahead).max { $0.column < $1.column })
        // One closed column, then the takeable column, then two more.
        let threeColumnsOut = geometry.x(of: deepest)
            == ArgoRoute.originX + ArgoRoute.columnStep * 3

        #expect(deepest.column == 2)
        #expect(threeColumnsOut)
    }

    /// A chart whose children need more room gets a wider canvas, never a squashed one.
    @Test
    func `the canvas widens with the work in it`() throws {
        let shallow = try RouteGeometry(route: route(closed: 0, takeable: 1))
        let deep = try RouteGeometry(route: route(closed: 0, takeable: 1, blocked: 3))

        #expect(deep.width > shallow.width)
    }

    /// A parent with the shape the counts describe: `closed` resolved children, `takeable` open
    /// ones with no blockers, and `blocked` more forming a chain one deeper each.
    private func route(closed: Int, takeable: Int, blocked: Int = 0) throws
        -> WorkRoomProjection.Route {
        var items: [WorkItem] = []
        var children: [Int] = []
        var number = 100

        for _ in 0 ..< closed {
            items.append(WorkRouteFixture.closed(number))
            children.append(number)
            number += 1
        }
        for _ in 0 ..< takeable {
            items.append(WorkRouteFixture.node(number))
            children.append(number)
            number += 1
        }
        var waitsOn = children.last ?? 0
        for _ in 0 ..< blocked {
            items.append(
                WorkRouteFixture.node(
                    number,
                    blockedBy: [WorkItemBlocker(number: waitsOn, closure: .open)],
                ),
            )
            children.append(number)
            waitsOn = number
            number += 1
        }

        let parent = WorkRouteFixture.node(1, children: children)
        return try #require(WorkRoomProjection.route(of: parent, among: [parent] + items))
    }
}
