import ArgoEngine
import Foundation

/// The Route: one parent's children on a single progress axis, running left to right (#334, #335).
///
/// A second function over the SAME view models the tree and the ticket pane already read — no new
/// entity, no stored field, no new state vocabulary. The one thing computed here is **placement**,
/// and placement is geometry rather than state: which of three zones a child stands in, and how
/// many closures stand between it and the line.
extension WorkRoomProjection {
    /// The chart the deck is scoped to, and both presentations of it. The head names the parent
    /// from here, so the crumb, the title and the map are one value and cannot come apart.
    struct ChartScope: Sendable, Equatable {
        let parent: Int
        let title: String
        /// The Route over it, and `nil` where the poll has reached none of its children — where the
        /// tree is the only honest presentation and the toggle has no map to offer.
        let route: Route?
    }

    struct Route: Sendable, Equatable {
        /// The parent the axis is over, and what a presentation toggle is keyed by: the Route is
        /// map-SCOPED, so switching this parent to a map changes nothing about any other ticket.
        let parent: Int
        let title: String
        /// The children, in the order the provider CHARTED them. Only children the poll reached: a
        /// stop for a ticket nobody has read would be a dot with nothing on it.
        let stops: [Stop]

        /// Where a child stands relative to the NOW line. Three, and they FALL OUT of remaining
        /// depth rather than being read off anything of their own.
        enum Zone: Sendable, Equatable, CaseIterable {
            /// Closed. Drawn as a quiet list, in charted order — its dependencies are satisfied, so
            /// it draws no edges.
            case behind
            /// Open with every blocker closed. Exactly the set a developer could pick up today,
            /// which is the whole answer the view exists to give.
            case now
            /// Open with open blockers, in the column its remaining depth names.
            case ahead
        }

        /// One child on the axis: the dot, the title beside it, and the words under them.
        struct Stop: Sendable, Equatable, Identifiable {
            let id: Int
            let title: String
            /// The provider's own status word, VERBATIM (#272). Where the ticket carries none,
            /// Argo's neutral bucket name stands in — the view never invents vocabulary a tracker
            /// does not use.
            let word: String
            /// The ticket's own type word where the provider typed it, and the first label it
            /// served otherwise — which is what lets one view read over a planning parent and over
            /// a spec with implementation sub-tickets alike.
            ///
            /// Absent where the ticket carries neither, and never PICKED: Argo does not classify a
            /// provider's labels, so reaching for a triage-shaped one by pattern would be Argo
            /// ranking somebody else's topics (#160).
            let tag: String?
            let zone: Zone
            /// #334's remaining depth — how many closures stand between this child and the line.
            /// `0` behind the line and on it; `1` one closure away, and so on ahead of it.
            let column: Int
            /// Its place within its own column, in charted order at a fixed pitch. The vertical the
            /// canvas draws it on follows from this; #337 owns deriving that from real label
            /// widths, and until then a column stacks.
            let row: Int
        }

        /// How many columns stand ahead of the line, and `0` on a parent with nothing ahead. What
        /// the canvas is as wide as.
        var reach: Int {
            stops.map(\.column).max() ?? 0
        }

        func stops(in zone: Zone) -> [Stop] {
            stops.filter { $0.zone == zone }
        }
    }

    /// The parent's Route, and `nil` where the poll has reached none of its children — a progress
    /// axis over nothing is an empty canvas, not a state, and the tree is the honest presentation
    /// of a parent nobody has read the inside of.
    static func route(of parent: WorkItem, among items: [WorkItem], claimed: Set<Int> = [])
        -> Route? {
        let byNumber = Dictionary(items.map { ($0.number, $0) }, uniquingKeysWith: { first, _ in
            first
        })
        let children = parent.children.compactMap { byNumber[$0] }
        guard !children.isEmpty else { return nil }

        var depth = RouteDepth(items: byNumber)
        // Every column resolved BEFORE any stop is built, because a child's column is a walk over
        // edges reaching outside this parent's own children and the walk memoizes as it goes.
        let columns = children.reduce(into: [Int: Int]()) { columns, child in
            columns[child.number] = child.closure == .open ? depth.remaining(of: child.number) : 0
        }

        var filled: [Int: Int] = [:]
        let stops = children.map { child -> Route.Stop in
            let column = columns[child.number] ?? 0
            let zone = zone(of: child, at: column)
            // Behind the line keeps its own stack rather than sharing the takeable column's: the
            // two sit either side of the line and their rows are counted apart.
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

    /// The chart the deck is scoped to, and `nil` where the rail is on a view or where the chart's
    /// own parent is not in the listing — a head naming a ticket nobody read would be a claim.
    static func chartScope(_ parent: Int?, in reading: WorkReading) -> ChartScope? {
        guard let parent, let item = reading.items.first(where: { $0.number == parent })
        else { return nil }
        return ChartScope(
            parent: item.number,
            title: item.title,
            route: route(of: item, among: reading.items, claimed: reading.claimed),
        )
    }

    /// The chart and everything under it, in the parent's own order — the open items the SCOPED
    /// tree draws. Closed children are left out here for the same reason the backlog leaves them
    /// out; the Route is where they are drawn, behind the line.
    static func scoped(_ open: [WorkItem], to parent: Int) -> [WorkItem] {
        let byNumber = Dictionary(open.map { ($0.number, $0) }, uniquingKeysWith: { first, _ in
            first
        })
        var reached: Set<Int> = []
        var walk = [parent]
        while let number = walk.popLast() {
            // The insert IS the visited check, which is what makes a child claimed by two parents —
            // or an edge that loops — cost nothing rather than looping the walk.
            guard reached.insert(number).inserted else { continue }
            walk.append(contentsOf: byNumber[number]?.children ?? [])
        }
        return open.filter { reached.contains($0.number) }
    }

    /// The three zones, told once and derived from nothing but closure and remaining depth.
    private static func zone(of child: WorkItem, at column: Int) -> Route.Zone {
        guard child.closure == .open else { return .behind }
        return column == 0 ? .now : .ahead
    }

    /// The provider's word, or Argo's bucket where the provider served none. The FALLBACK and not a
    /// translation: a ticket that carries a word renders that word however Argo would file it.
    private static func word(of child: WorkItem, claimed: Set<Int>) -> String {
        let spoken = child.status.trimmingCharacters(in: .whitespaces)
        guard spoken.isEmpty else { return spoken }
        return child.state(claimed: claimed.contains(child.number)).filing
    }
}
