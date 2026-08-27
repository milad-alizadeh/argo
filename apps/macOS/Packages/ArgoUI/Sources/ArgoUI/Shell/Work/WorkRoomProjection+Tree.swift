import ArgoEngine

/// The backlog's nesting, derived from the CHILD EDGE (#814). Nothing here reads a nested literal:
/// the provider serves `children` per item and the shape of the list follows from it, so moving a
/// ticket upstream moves a row without anybody editing a fixture.
///
/// Two ways an edge can lie are resolved rather than trusted. A child claimed by two parents hangs
/// under the first that claimed it, and an edge that would make an item its own ancestor is refused
/// — both so that every shown item is drawn EXACTLY once. A tree that loses a row to a bad edge is
/// worse than a tree that flattens one.
extension WorkRoomProjection {
    /// One row as the list draws it: the row itself and how far in it sits. Flat, because selection
    /// and row height are the `List`'s and a `List` counts rows rather than subtrees.
    struct Drawn: Sendable, Equatable, Identifiable {
        let row: Row
        /// Levels from the root, UNCAPPED — the inset caps at `indentDepthCap`, the depth does not,
        /// so a reader asking how deep a ticket sits gets the truth.
        let depth: Int

        /// The row's own priority word where the band's header DISAGREES with it, and `nil` where
        /// the header already said it (#819). A relation to the header rather than a fact of the
        /// row, which is why it is set when the band is flattened and not when the tree is built.
        var odd: String?

        var id: Int {
            row.id
        }

        /// A leaf keeps the twist's slot but never its mark, so every dot lands on one vertical.
        var isParent: Bool {
            !row.children.isEmpty
        }

        /// The one trailing fact. A parent's roll-up WINS the slot: two numbers in one place is
        /// worse than an odd priority left unsaid, and the header over it is already the louder
        /// claim about a row that has children of its own.
        var trailing: String? {
            row.trailing ?? odd
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
    static func tree(of shown: [WorkItem], reading: WorkReading, closed: Set<Int>) -> [Row] {
        let parents = parentEdges(of: shown)
        let byNumber = Dictionary(uniqueKeysWithValues: shown.map { ($0.number, $0) })

        func node(_ item: WorkItem) -> Row {
            Row(
                id: item.number,
                title: item.title,
                delivery: reading.deliveries[item.number] ?? .absent,
                trailing: rollUp(of: item, closed: closed),
                priority: reading.priorities[item.number],
                children: item.children
                    .filter { parents[$0] == item.number }
                    .compactMap { byNumber[$0] }
                    .map(node),
            )
        }

        return shown.filter { parents[$0.number] == nil }.map(node)
    }

    /// Which shown item owns each shown child. Built once for the whole set rather than asked per
    /// node, because the answer for one child depends on every other edge served.
    private static func parentEdges(of shown: [WorkItem]) -> [Int: Int] {
        let numbers = Set(shown.map(\.number))
        var parents: [Int: Int] = [:]
        for item in shown {
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
