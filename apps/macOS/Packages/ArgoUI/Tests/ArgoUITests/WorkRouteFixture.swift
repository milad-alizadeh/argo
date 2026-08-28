import ArgoEngine
@testable import ArgoUI

/// The tickets the Route's three suites build their graphs from, and the accessors they read a
/// placed stop back with.
///
/// Titles are the numbers: what a Route reads of a child is its closure, its edges and its own
/// words, so prose titles would only make the expectations longer.
enum WorkRouteFixture {
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

    static func closed(_ number: Int) -> WorkItem {
        WorkItem(number: number, title: "#\(number)", status: "Done", closure: .resolved)
    }

    /// A ticket the provider named and said nothing else about.
    static func wordless(_ number: Int) -> WorkItem {
        WorkItem(number: number, title: "#\(number)", status: "", closure: .open)
    }

    static func stop(_ number: Int, in route: WorkRoomProjection.Route)
        -> WorkRoomProjection.Route.Stop? {
        route.stops.first { $0.id == number }
    }
}
