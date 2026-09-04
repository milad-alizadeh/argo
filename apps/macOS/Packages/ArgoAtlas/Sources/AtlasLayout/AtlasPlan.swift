import CoreGraphics

/// A laid-out map: every Plot placed, every Plate framed, and the ground the whole city stands on.
///
/// Flat and resolution-independent for the reason `MermaidPlan` is: nothing downstream may know
/// which walk of the tree produced it, so one renderer draws whatever the layout decided. The two
/// lists are separate rather than nested for the same reason — a renderer draws every plate and
/// then every tile, and a tree would make it walk one.
///
/// `extent` is in points, which is what `AtlasView` frames by today. When the camera lands it
/// becomes the map's own units and the camera is what turns one into the other — but that is a
/// change to make WITH the camera, not a claim to write ahead of it, because a doc comment
/// promising a unit no code converts is a unit nothing keeps.
public struct AtlasPlan: Equatable, Sendable {
    /// The ground the plots are tiled into.
    public let extent: CGSize

    /// Every folder, outermost first, each holding the ones after it that its rect contains.
    public let plates: [AtlasPlateFrame]

    /// Every file, in the order the walk placed them.
    public let tiles: [AtlasTile]

    public init(extent: CGSize, plates: [AtlasPlateFrame] = [], tiles: [AtlasTile] = []) {
        self.extent = extent
        self.plates = plates
        self.tiles = tiles
    }

    /// The map of a repository nothing has been scanned from yet. Not an optional and not a
    /// failure: an empty city still has a floor, and every caller downstream draws one the same
    /// way it draws a full one.
    public static let empty = AtlasPlan(extent: .zero)

    /// Tiles a Map: a squarified treemap of every Plot, each sized by one Measure and banded by
    /// another against the repository's own distribution.
    ///
    /// A file's area is proportional to its Measure AMONG THE FILES ON ITS OWN PLATE, exactly. It
    /// is not proportional across the whole map, and cannot be: a Plate spends part of its ground
    /// on the ring and name strip that make it readable as a folder, and that room comes off
    /// everything standing on it. Nesting is what the reader asked for by looking at folders at
    /// all, and the cost of it is stated here rather than hidden in a tolerance.
    public init(tiling map: AtlasMap, by channels: AtlasChannels, into extent: CGSize) {
        self = AtlasTiler.plan(of: map, by: channels, into: extent)
    }
}
