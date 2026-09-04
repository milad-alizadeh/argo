import AtlasLayout
import Foundation

/// The Map the Atlas room specimen draws: a real measurement of this repository at commit
/// `4478553`, cut from the fixture committed beside `AtlasLayoutTests` (#1145).
///
/// Real rather than synthetic, for the reason that fixture's own README gives. The cut kept every
/// awkward case it was made for: one file of 4,800 lines against a median of 61, PNGs carrying no
/// `lines` at all, a file measuring zero, and a path eleven levels down. A treemap tested on tidy
/// numbers is one that breaks on the first repository.
enum AtlasRoomSpecimenMap {
    /// One file of the fixture: where it sits under the root, and what was measured about it.
    typealias Measured = (path: String, measures: [String: Double])

    static let trimmed = AtlasMap(
        measuredAt: Date(timeIntervalSince1970: 1_772_000_000),
        commit: "4478553597b9f54568ed277d3753aba87ab1d980",
        root: AtlasPlate(path: "argo", children: nodes(of: measured, inside: "argo")),
    )

    /// The same nesting the generator writes, rebuilt from paths: children grouped by their first
    /// component in the order they appear, so the specimen tiles what a Map file would.
    ///
    /// The rows are flat and this walks them, rather than the tree being spelled out: written in
    /// full, every path past the fourth level runs over the line length the linter holds, and a
    /// fixture nobody can read is one nobody will extend.
    private static func nodes(of files: [Measured], inside parent: String) -> [AtlasNode] {
        var order: [Substring] = []
        var grouped: [Substring: [Measured]] = [:]
        for file in files {
            let components = file.path.split(separator: "/")
            guard let head = components.first else { continue }
            if grouped[head] == nil {
                order.append(head)
            }
            grouped[head, default: []].append(
                (path: components.dropFirst().joined(separator: "/"), measures: file.measures),
            )
        }
        return order.map { head in
            let path = parent + "/" + head
            let held = grouped[head] ?? []
            guard let first = held.first, first.path.isEmpty else {
                return .plate(AtlasPlate(path: path, children: nodes(of: held, inside: path)))
            }
            return .plot(AtlasPlot(path: path, measures: first.measures))
        }
    }
}
