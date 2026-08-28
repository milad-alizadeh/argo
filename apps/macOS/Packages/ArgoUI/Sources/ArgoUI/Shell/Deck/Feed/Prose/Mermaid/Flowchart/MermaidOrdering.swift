import Foundation

/// The order the nodes of each rank stand in, chosen to cross as few edges as possible.
///
/// The median heuristic, run a fixed number of times: each node slides to the median position of
/// its neighbours in the rank above, then in the rank below, and the arrangement with the fewest
/// crossings wins. A FIXED number of passes and a `<` rather than a `≤` on the winner are what make
/// it deterministic — the same source has to lay out identically every run, or the height the lane
/// reports is a height nobody drew.
enum MermaidOrdering {
    /// How many times the sweep runs. Four is where the fixtures stop improving; more passes cost
    /// layout time on every diagram to move none of them.
    private static let passes = 4
}

extension MermaidOrdering {
    /// The rows of `chart`, each in the order its nodes should be drawn.
    static func rows(of chart: MermaidFlowchart, ranked: MermaidRanking) -> [[String]] {
        var best = grouped(ranked.rows(of: chart.names), by: chart.groups)
        var fewest = crossings(of: best, in: chart)
        var rows = best
        for pass in 0 ..< passes {
            // Cohesion is re-imposed after every sweep, not only on the way in: a sweep is free to
            // slide a member of a group past a stranger, and an enclosure drawn around a rank that
            // happened would close over a node it does not own.
            rows = grouped(
                swept(rows, in: chart, downward: pass.isMultiple(of: 2)),
                by: chart.groups,
            )
            let count = crossings(of: rows, in: chart)
            guard count < fewest else { continue }
            fewest = count
            best = rows
        }
        return best
    }

    /// One sweep: every rank but the one it reads from, re-sorted on where its neighbours sit.
    private static func swept(
        _ rows: [[String]],
        in chart: MermaidFlowchart,
        downward: Bool,
    )
        -> [[String]] {
        var rows = rows
        let order = downward ? Array(rows.indices) : rows.indices.reversed().map(\.self)
        for at in order.dropFirst() {
            let fixed = rows[downward ? at - 1 : at + 1]
            rows[at] = sorted(rows[at], against: fixed) {
                neighbours(of: $0, in: chart, above: downward)
            }
        }
        return rows
    }

    /// One rank, re-sorted on the median of each node's neighbours in the fixed rank beside it. A
    /// node with no neighbour there keeps the place it already had, which is what stops a sweep
    /// shuffling the nodes it has nothing to say about.
    private static func sorted(
        _ row: [String],
        against fixed: [String],
        joining neighbours: (String) -> [String],
    )
        -> [String] {
        let keys = row.enumerated().reduce(into: [String: Double]()) { keys, pair in
            let places = neighbours(pair.element)
                .compactMap { fixed.firstIndex(of: $0) }
                .sorted()
            keys[pair.element] = places.isEmpty
                ? Double(pair.offset)
                : Double(places[places.count / 2])
        }
        return stable(row) { keys[$0] ?? 0 }
    }

    /// A rank sorted on a key, ties broken by the place a node already had. Stability is the whole
    /// point: two nodes a pass has nothing to say about have to come out in the order they went in,
    /// or the same source lays out differently on the next run.
    private static func stable(_ row: [String], on key: (String) -> Double) -> [String] {
        row.enumerated()
            .sorted { left, right in
                let (first, second) = (key(left.element), key(right.element))
                return first == second ? left.offset < right.offset : first < second
            }
            .map(\.element)
    }

    /// The nodes one node is joined to in the rank on one side of it.
    private static func neighbours(
        of name: String,
        in chart: MermaidFlowchart,
        above: Bool,
    )
        -> [String] {
        chart.edges.compactMap { edge in
            if above, edge.to == name {
                return edge.from
            }
            if !above, edge.from == name {
                return edge.to
            }
            return nil
        }
    }

    /// How many pairs of edges between two neighbouring ranks cross — the inversions between where
    /// their two ends sit. The heuristic's own score, counted the same way every pass.
    static func crossings(of rows: [[String]], in chart: MermaidFlowchart) -> Int {
        rows.indices.dropLast().reduce(0) { total, at in
            let pairs = chart.edges.compactMap { edge -> (Int, Int)? in
                guard let from = rows[at].firstIndex(of: edge.from),
                      let to = rows[at + 1].firstIndex(of: edge.to) else { return nil }
                return (from, to)
            }
            return total + pairs.indices.reduce(0) { count, one in
                count + pairs[(one + 1)...].count { other in
                    (pairs[one].0 - other.0) * (pairs[one].1 - other.1) < 0
                }
            }
        }
    }

    /// The same rows with each `subgraph`'s members drawn together. An enclosure is a box around
    /// its members, so members standing either side of a stranger would draw a box over them.
    private static func grouped(
        _ rows: [[String]],
        by groups: [MermaidFlowchart.Group],
    )
        -> [[String]] {
        rows.map { row in stable(row) { Double(groups.place(of: $0)) } }
    }
}

private extension [MermaidFlowchart.Group] {
    /// Which enclosure a node belongs to, as a sort key. A node in none of them sorts after every
    /// node in one, so the groups stay whole and the loose nodes stand beside them.
    func place(of name: String) -> Int {
        firstIndex { $0.members.contains(name) } ?? count
    }
}
