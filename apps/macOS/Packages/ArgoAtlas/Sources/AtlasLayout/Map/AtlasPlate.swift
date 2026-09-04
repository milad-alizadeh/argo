/// One folder of a repository: a name, and the nodes standing on it (#1145).
///
/// It carries nothing of its own. Every number a Plate reads by is `total(of:)` over its Plots,
/// summed on demand and never stored, so a Plate cannot come to disagree with what is on it.
public struct AtlasPlate: Equatable, Sendable {
    /// Where the folder sits, from the Map's root down. The root Plate's path is its own name.
    public let path: String

    /// What stands on the Plate, in the order the generator measured it.
    public let children: [AtlasNode]

    public init(path: String, children: [AtlasNode]) {
        self.path = path
        self.children = children
    }

    /// What the folder is called on disk.
    public var name: String {
        AtlasPath.name(of: path)
    }

    /// What this Plate measures, its Plots summed over the whole subtree.
    public func total(of measure: String) -> Double {
        children.reduce(0) { $0 + $1.total(of: measure) }
    }

    /// Every Plot on the Plate, however deep, in the order the Map holds them.
    public var plots: [AtlasPlot] {
        children.flatMap(\.plots)
    }
}
