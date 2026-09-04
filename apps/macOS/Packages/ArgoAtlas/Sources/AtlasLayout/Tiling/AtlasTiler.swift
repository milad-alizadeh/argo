import CoreGraphics

/// The walk from a Map to a plan: every Plate framed, every Plot tiled into the Plate it stands on.
struct AtlasTiler {
    let channels: AtlasChannels
    let banding: AtlasBanding

    /// What a Plot measuring nothing is tiled as: the least any measured file in this repository
    /// measures.
    ///
    /// A floor and not a fudge. A zero-weight file is a zero-area rectangle, which is a file that
    /// is on the map and cannot be pointed at — and the whole point of the map is that everything
    /// in the repository is somewhere on it. Drawing it as small as the smallest thing that WAS
    /// measured is the one size that says "the least there is" without inventing a number.
    let floor: Double

    private var plates: [AtlasPlateFrame] = []
    private var tiles: [AtlasTile] = []

    init(channels: AtlasChannels, map: AtlasMap) {
        self.channels = channels
        self.banding = AtlasBanding(of: channels.band, over: map)
        self.floor = map.values(of: channels.footprint).filter { $0 > 0 }.min() ?? 1
    }

    /// The plan for one Map on one ground.
    static func plan(
        of map: AtlasMap,
        by channels: AtlasChannels,
        into extent: CGSize,
    )
        -> AtlasPlan {
        var tiler = AtlasTiler(channels: channels, map: map)
        tiler.place(.plate(map.root), in: CGRect(origin: .zero, size: extent), depth: 0)
        return AtlasPlan(
            extent: extent,
            plates: tiler.plates,
            tiles: tiler.tiles,
            legend: AtlasLegend(measure: channels.band, over: tiler.banding),
        )
    }

    private mutating func place(_ node: AtlasNode, in rect: CGRect, depth: Int) {
        switch node {
        case let .plot(plot):
            tiles.append(AtlasTile(
                path: plot.path,
                rect: rect,
                band: banding.band(of: plot.value(of: channels.band)),
            ))
        case let .plate(plate):
            let run = AtlasTiler.folding(from: plate)
            plates.append(AtlasPlateFrame(
                path: run.plate.path,
                name: run.name,
                rect: rect,
                depth: depth,
            ))
            // Weighed ONCE and then sorted, rather than weighed inside the comparator: a Plate's
            // weight is a walk of its whole subtree, and a comparator that took one would re-walk
            // the deep half of the tree on every comparison, at every level.
            let weighed = run.plate.children
                .map { (node: $0, weight: weight(of: $0)) }
                .sorted(by: heaviestFirst)
            let rects = AtlasSquarify.rects(
                of: weighed.map(\.weight),
                in: AtlasFraming.interior(of: rect),
            )
            for (child, childRect) in zip(weighed, rects) {
                place(child.node, in: childRect, depth: depth + 1)
            }
        }
    }

    /// A folder holding nothing but one folder, folded into the one below it, as far down as the
    /// run goes.
    ///
    /// It has no files to stand on it and no choice to offer the reader, so a plate of its own
    /// spends a name strip and a ring on nothing and takes that room off everything below it —
    /// seven in a row, in this repository, before the first file is drawn. What the reader loses
    /// is nothing: the run is written into the name the way a path is written.
    ///
    /// A folder holding a folder AND a file of its own is NOT folded. The file has to stand
    /// somewhere, and folding would put it on a plate named for a folder it is not in.
    static func folding(from plate: AtlasPlate) -> (plate: AtlasPlate, name: String) {
        var deepest = plate
        var run = [plate.name]
        while deepest.children.count == 1, case let .plate(only) = deepest.children[0] {
            deepest = only
            run.append(only.name)
        }
        return (deepest, run.joined(separator: "/"))
    }

    /// Heaviest first, and by path where two weigh the same.
    ///
    /// The path is what makes the order TOTAL, and a total order is the whole claim that a map
    /// tiles the same way twice: leave it out and two equal-weight files are ordered by whatever
    /// the sort happened to do, which is how a map comes out different on every launch.
    private func heaviestFirst(
        _ one: (node: AtlasNode, weight: Double),
        _ other: (node: AtlasNode, weight: Double),
    )
        -> Bool {
        one.weight == other.weight
            ? one.node.path < other.node.path
            : one.weight > other.weight
    }

    /// What a node asks for, in units of the footprint Measure — its own value against the floor,
    /// and its subtree's summed for a Plate. An EMPTY Plate takes the floor too: a folder holding
    /// nothing measured is still a folder in the repository, and a zero-area plate is a folder that
    /// was silently dropped.
    private func weight(of node: AtlasNode) -> Double {
        switch node {
        case let .plot(plot):
            max(plot.value(of: channels.footprint) ?? 0, floor)
        case let .plate(plate):
            max(plate.children.reduce(0) { $0 + weight(of: $1) }, floor)
        }
    }
}
