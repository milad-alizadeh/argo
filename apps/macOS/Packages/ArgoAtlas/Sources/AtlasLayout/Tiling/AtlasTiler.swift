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
        let measured = map.plots.compactMap { $0.measures[channels.footprint] }.filter { $0 > 0 }
        self.floor = measured.min() ?? 1
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
        return AtlasPlan(extent: extent, plates: tiler.plates, tiles: tiler.tiles)
    }

    private mutating func place(_ node: AtlasNode, in rect: CGRect, depth: Int) {
        switch node {
        case let .plot(plot):
            tiles.append(AtlasTile(
                path: plot.path,
                rect: rect,
                band: banding.band(of: plot.measures[channels.band]),
            ))
        case let .plate(plate):
            plates.append(AtlasPlateFrame(path: plate.path, rect: rect, depth: depth))
            let ordered = plate.children.sorted(by: heaviestFirst)
            let inside = AtlasMeasure.interior(of: rect)
            let rects = AtlasSquarify.rects(of: ordered.map(weight(of:)), in: inside)
            for (child, childRect) in zip(ordered, rects) {
                place(child, in: childRect, depth: depth + 1)
            }
        }
    }

    /// Heaviest first, and by path where two weigh the same.
    ///
    /// The path is what makes the order TOTAL, and a total order is the whole claim that a map
    /// tiles the same way twice: leave it out and two equal-weight files are ordered by whatever
    /// the sort happened to do, which is how a map comes out different on every launch.
    private func heaviestFirst(_ one: AtlasNode, _ other: AtlasNode) -> Bool {
        let (first, second) = (weight(of: one), weight(of: other))
        return first == second ? one.path < other.path : first > second
    }

    /// What a node asks for, in units of the footprint Measure — its own value against the floor,
    /// and its subtree's summed for a Plate. An EMPTY Plate takes the floor too: a folder holding
    /// nothing measured is still a folder in the repository, and a zero-area plate is a folder that
    /// was silently dropped.
    private func weight(of node: AtlasNode) -> Double {
        switch node {
        case let .plot(plot):
            max(plot.measures[channels.footprint] ?? 0, floor)
        case let .plate(plate):
            max(plate.children.reduce(0) { $0 + weight(of: $1) }, floor)
        }
    }
}
