import CoreGraphics

/// A laid-out map: every plot placed, and the ground the whole city stands on.
///
/// The seam the tiler will be built behind, and a placeholder until it is (#1143). Flat and
/// resolution-independent for the reason `MermaidPlan` is: nothing downstream may know which
/// walk of the tree produced it, so one renderer draws whatever the layout decided.
///
/// `extent` is in points, which is what `AtlasView` frames by today. When the camera lands it
/// becomes the map's own units and the camera is what turns one into the other — but that is a
/// change to make WITH the camera, not a claim to write ahead of it, because a doc comment
/// promising a unit no code converts is a unit nothing keeps.
public struct AtlasPlan: Equatable, Sendable {
    /// The ground the plots are tiled into.
    public let extent: CGSize

    public init(extent: CGSize) {
        self.extent = extent
    }

    /// The map of a repository nothing has been scanned from yet. Not an optional and not a
    /// failure: an empty city still has a floor, and every caller downstream draws one the same
    /// way it draws a full one.
    public static let empty = AtlasPlan(extent: .zero)
}
