import AtlasLayout
import Foundation

/// One measured file, before it has been put where it belongs.
///
/// Not an `AtlasPlot`, which it otherwise matches field for field: a Plot's path runs from the
/// Map's root down, and that root does not exist until the Plate below is named. What is here is
/// git's own path, relative to the repository.
struct AtlasMeasuredFile: Equatable, Sendable {
    let path: String
    let measures: [String: Double]
}

/// Turning a flat list of measured paths into the nested tree a Map holds (#1148).
///
/// Grouped by first appearance rather than by sorting, so the Map comes out in the order git
/// answered in — the same order twice, which is what stops a tiler laying out a different city on
/// every launch. A dictionary walked in its own order is the failure this shape exists to avoid.
enum AtlasNesting {
    static func plate(named name: String, holding files: [AtlasMeasuredFile]) -> AtlasPlate {
        AtlasPlate(path: name, children: nodes(files.map(Entry.init), inside: name))
    }

    /// One file, walked a component at a time: `components` is what is left of its path below the
    /// Plate being built.
    private struct Entry {
        var components: ArraySlice<Substring>
        let measures: [String: Double]

        init(_ file: AtlasMeasuredFile) {
            self.components = file.path.split(separator: "/")[...]
            self.measures = file.measures
        }

        /// The same file, read one Plate further down.
        func descended() -> Entry {
            var next = self
            next.components = components.dropFirst()
            return next
        }
    }

    private static func nodes(_ entries: [Entry], inside parent: String) -> [AtlasNode] {
        var order: [Substring] = []
        var grouped: [Substring: [Entry]] = [:]
        for entry in entries {
            guard let head = entry.components.first else { continue }
            if grouped[head] == nil {
                order.append(head)
            }
            grouped[head, default: []].append(entry.descended())
        }
        return order.map { head in
            let path = parent + "/" + head
            let held = grouped[head] ?? []
            // One name is a file or a folder and never both, because git cannot track a path and a
            // path under it at once — so the first entry settles which this is.
            guard let file = held.first, file.components.isEmpty else {
                return .plate(AtlasPlate(path: path, children: nodes(held, inside: path)))
            }
            return .plot(AtlasPlot(path: path, measures: file.measures))
        }
    }
}
