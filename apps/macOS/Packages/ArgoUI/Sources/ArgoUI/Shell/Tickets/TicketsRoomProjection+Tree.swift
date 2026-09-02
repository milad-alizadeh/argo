import ArgoEngine
import Foundation

/// The backlog's nesting, derived from the CHILD EDGE (#814). Nothing here reads a nested literal:
/// the provider serves `children` per item and the shape of the list follows from it, so moving a
/// ticket upstream moves a row without anybody editing a fixture.
///
/// Two ways an edge can lie are resolved rather than trusted, and both resolutions are Argo's own
/// rather than the provider array's (#919). A child claimed by two parents hangs under the
/// LOWEST-NUMBERED of them, and an edge that would make an item its own ancestor is refused — both
/// so that every shown item is drawn EXACTLY once. A tree that loses a row to a bad edge is worse
/// than a tree that flattens one.
extension TicketsRoomProjection {
    /// One row as the list draws it: the row itself and how far in it sits. Flat, because selection
    /// and row height are the `List`'s and a `List` counts rows rather than subtrees.
    struct Drawn: Sendable, Equatable, Identifiable {
        let row: Row
        /// Levels from the root, UNCAPPED — the inset caps at `indentDepthCap`, the depth does not,
        /// so a reader asking how deep a ticket sits gets the truth.
        let depth: Int

        /// The row's own priority word where the band's header disagrees with it (#819). Set when
        /// the band is flattened: which header a row lands under is not something the tree knows.
        var odd: String?

        var id: Int {
            row.id
        }

        /// A leaf keeps the twist's slot but never its mark, so every dot lands on one vertical.
        var isParent: Bool {
            !row.children.isEmpty
        }

        /// The one caption the trailing region carries, and the only place its precedence is
        /// spelled (`cockpit-work-room.md` — the trailing region): a parent's roll-up, then a
        /// child's odd priority, then the age. First one present wins; the rest are not drawn.
        ///
        /// The age is LAST because nearly every row has one — an age that outranked the other two
        /// would silently delete them from the only list that states them. It is also why nothing
        /// here defaults: a row the provider served no date for draws no caption, not a gap.
        ///
        /// The blockage mark is not in this order. It answers a different question — whether the
        /// ticket can be started, rather than what it is or how long it has sat — so a row that is
        /// both blocked and stale draws both rather than choosing.
        func caption(asOf now: Date) -> String? {
            row.trailing ?? odd ?? row.touched.map { TicketAge.stamp(since: $0, asOf: now) }
        }
    }

    /// The rows in draw order, parents before their children, a shut parent standing for its whole
    /// subtree.
    static func drawn(_ rows: [Row], shut: Set<Int>, from depth: Int = 0) -> [Drawn] {
        rows.flatMap { row -> [Drawn] in
            let head = Drawn(row: row, depth: depth)
            guard !shut.contains(row.id) else { return [head] }
            return [head] + drawn(row.children, shut: shut, from: depth + 1)
        }
    }

    /// The shown items as a tree. A shown item whose parent is also shown nests under it, and
    /// everything else is a root — which keeps a view's filter from taking a child down with its
    /// parent.
    static func tree(of shown: [Ticket], reading: TicketsReading, closed: Set<Int>) -> [Row] {
        let parents = parentEdges(of: shown)
        let byNumber = Dictionary(uniqueKeysWithValues: shown.map { ($0.number, $0) })

        func node(_ item: Ticket) -> Row {
            let siblings = item.children.filter { parents[$0] == item.number }
                .compactMap { byNumber[$0] }
            return Row(
                id: item.number,
                title: item.title,
                delivery: reading.deliveries[item.number] ?? .absent,
                trailing: rollUp(of: item, closed: closed),
                priority: item.priority,
                labels: item.labels,
                children: newest(siblings).map(node),
                blockage: blockage(of: item),
                isClaimed: reading.claimed.contains(item.number),
                touched: item.updatedAt,
            )
        }

        return newest(shown.filter { parents[$0.number] == nil }).map(node)
    }

    /// The list's own order, stated rather than inherited: highest number first, siblings against
    /// siblings (#892).
    private static func newest(_ items: [Ticket]) -> [Ticket] {
        items.sorted { $0.number > $1.number }
    }

    /// Which shown item owns each shown child. Built once for the whole set rather than asked per
    /// node, because the answer for one child depends on every other edge served — and in a stated
    /// order — `Ticket.oldestFirst` — so a contested edge and a refused cycle resolve the same way
    /// on every poll.
    static func parentEdges(of shown: [Ticket]) -> [Int: Int] {
        let numbers = Set(shown.map(\.number))
        var parents: [Int: Int] = [:]
        for item in Ticket.oldestFirst(shown) {
            for child in item.children
                where numbers.contains(child) && parents[child] == nil && child != item.number
                && !wouldCycle(adding: child, under: item.number, given: parents) {
                parents[child] = item.number
            }
        }
        return parents
    }

    /// Whether hanging `child` under `parent` would close a loop — true when `child` is already
    /// one of `parent`'s ancestors. The walk terminates because `edges` holds no cycle yet, which
    /// is the invariant refusing this edge keeps.
    private static func wouldCycle(adding child: Int, under parent: Int, given edges: [Int: Int])
        -> Bool {
        var walk: Int? = parent
        while let step = walk {
            if step == child {
                return true
            }
            walk = edges[step]
        }
        return false
    }
}
