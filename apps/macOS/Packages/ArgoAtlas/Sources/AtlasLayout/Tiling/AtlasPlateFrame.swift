import CoreGraphics

/// One Plate, placed: the ground a folder's files stand on, and the strip its name is drawn in.
///
/// The rect is the WHOLE plate, frame included. What stands on it is tiled into
/// `AtlasMeasure.interior(of:)` of this rect, so the plate reads as the union of its children plus
/// its own padding without anything having to store that union.
public struct AtlasPlateFrame: Equatable, Sendable {
    public let path: String
    public let rect: CGRect

    /// How far in from the root the folder sits, 0 at the root. The materials family gives three
    /// plate tones and repeats the deepest past that, so the tone is read off this number rather
    /// than counted again by whatever draws it.
    public let depth: Int

    public init(path: String, rect: CGRect, depth: Int) {
        self.path = path
        self.rect = rect
        self.depth = depth
    }

    /// What the folder is called on disk — the name the plate carries.
    public var name: String {
        AtlasPath.name(of: path)
    }
}
