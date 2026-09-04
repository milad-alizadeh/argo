/// One node of a Map: a Plot, or a Plate holding more nodes.
///
/// A single closed kind rather than two parallel lists, because the tiler walks children in the
/// order the generator wrote them, and a Plate that kept its folders apart from its files would
/// tile a different city than the one measured.
public enum AtlasNode: Equatable, Sendable {
    case plot(AtlasPlot)
    case plate(AtlasPlate)

    /// Where the node sits in the repository, from the Map's root down.
    public var path: String {
        switch self {
        case let .plot(plot): plot.path
        case let .plate(plate): plate.path
        }
    }

    /// What this node measures, Plots summed over the whole subtree.
    ///
    /// A Plate stores no number of its own, so a Plate and its Plots can never disagree. A measure
    /// a Plot does not carry counts as nothing rather than as absent: the sum over a subtree where
    /// only half the Plots were measured is still the sum of what was measured.
    public func total(of measure: String) -> Double {
        switch self {
        case let .plot(plot): plot.measures[measure] ?? 0
        case let .plate(plate): plate.children.reduce(0) { $0 + $1.total(of: measure) }
        }
    }

    /// Every Plot at or under this node, in the order the Map holds them.
    public var plots: [AtlasPlot] {
        switch self {
        case let .plot(plot): [plot]
        case let .plate(plate): plate.children.flatMap(\.plots)
        }
    }
}
