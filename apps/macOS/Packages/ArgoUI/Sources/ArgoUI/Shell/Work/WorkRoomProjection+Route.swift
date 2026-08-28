import ArgoEngine
import Foundation

/// The Route: one parent's children on a progress axis, left to right (#334, #335). A second
/// function over the view models the tree and the ticket pane already read — the only thing
/// computed here is placement.
extension WorkRoomProjection {
    /// The chart the deck is scoped to, and both presentations of it.
    struct ChartScope: Sendable, Equatable {
        let parent: Int
        let title: String
        /// `nil` where the poll reached none of the parent's children, which is the one case the
        /// canvas cannot draw.
        let route: Route?
    }

    struct Route: Sendable, Equatable {
        let parent: Int
        let title: String
        /// In the order the provider charted them, and only the children the poll reached.
        let stops: [Stop]

        enum Zone: Sendable, Equatable, CaseIterable {
            /// Closed. Its dependencies are satisfied, so it draws no edges.
            case behind
            /// Open with every blocker closed — exactly the takeable set.
            case now
            /// Open with open blockers.
            case ahead
        }

        struct Stop: Sendable, Equatable, Identifiable {
            let id: Int
            let title: String
            /// The provider's status word verbatim, or Argo's bucket name where it served none.
            let word: String
            /// The ticket's own type word, or the first label it served. `nil` where it has
            /// neither.
            let tag: String?
            let zone: Zone
            /// Remaining depth: closures still standing between this child and the line. `0` behind
            /// the line and on it.
            let column: Int
            /// Place within its own column, in charted order.
            let row: Int
        }

        /// Columns standing ahead of the line, and `0` with nothing ahead.
        var reach: Int {
            stops.map(\.column).max() ?? 0
        }

        func stops(in zone: Zone) -> [Stop] {
            stops.filter { $0.zone == zone }
        }
    }

    static func route(of parent: WorkItem, among items: [WorkItem], claimed: Set<Int> = [])
        -> Route? {
        let byNumber = indexed(items)
        let children = parent.children.compactMap { byNumber[$0] }
        guard !children.isEmpty else { return nil }

        var depth = RouteDepth(items: byNumber)
        let columns = children.reduce(into: [Int: Int]()) { columns, child in
            columns[child.number] = child.closure == .open ? depth.remaining(of: child.number) : 0
        }

        var filled: [Int: Int] = [:]
        let stops = children.map { child -> Route.Stop in
            let column = columns[child.number] ?? 0
            let zone = zone(of: child, at: column)
            // Behind the line stacks apart from the takeable column: the two sit either side of it.
            let slot = zone == .behind ? -1 : column
            let row = filled[slot, default: 0]
            filled[slot] = row + 1
            return Route.Stop(
                id: child.number,
                title: child.title,
                word: word(of: child, claimed: claimed),
                tag: child.type ?? child.labels.first,
                zone: zone,
                column: column,
                row: row,
            )
        }
        return Route(parent: parent.number, title: parent.title, stops: stops)
    }

    /// Keyed off the same `showing` the ticket pane is, so the map and the parent under it cannot
    /// come apart.
    static func chartScope(_ parent: Int?, in reading: WorkReading) -> ChartScope? {
        guard let parent, let item = reading.items.first(where: { $0.number == parent })
        else { return nil }
        return ChartScope(
            parent: item.number,
            title: item.title,
            route: route(of: item, among: reading.items, claimed: reading.claimed),
        )
    }

    /// The chart and every open item under it. Closed children are left out for the reason the
    /// backlog leaves them out; the Route draws them behind the line.
    static func scoped(_ open: [WorkItem], to parent: Int) -> [WorkItem] {
        let byNumber = indexed(open)
        var reached: Set<Int> = []
        var walk = [parent]
        while let number = walk.popLast() {
            // The insert is the visited check, so a child claimed twice — or a looping edge — costs
            // nothing rather than looping the walk.
            guard reached.insert(number).inserted else { continue }
            walk.append(contentsOf: byNumber[number]?.children ?? [])
        }
        return open.filter { reached.contains($0.number) }
    }

    /// A first-wins index. First and not last, so a duplicate number cannot change which item a
    /// walk resolves to depending on where it sits in the listing.
    static func indexed(_ items: [WorkItem]) -> [Int: WorkItem] {
        Dictionary(items.map { ($0.number, $0) }, uniquingKeysWith: { first, _ in first })
    }

    private static func zone(of child: WorkItem, at column: Int) -> Route.Zone {
        guard child.closure == .open else { return .behind }
        return column == 0 ? .now : .ahead
    }

    /// A fallback, not a translation: a ticket carrying a word renders that word.
    private static func word(of child: WorkItem, claimed: Set<Int>) -> String {
        let spoken = child.status.trimmingCharacters(in: .whitespaces)
        guard spoken.isEmpty else { return spoken }
        return child.state(claimed: claimed.contains(child.number)).filing
    }
}
