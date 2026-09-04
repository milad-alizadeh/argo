import CoreGraphics

/// One Plate, placed: the ground a folder's files stand on, and the strip its name is drawn in.
///
/// The rect is the WHOLE plate, frame included. What stands on it is tiled into
/// `AtlasMeasure.interior(of:)` of this rect, so the plate reads as the union of its children plus
/// its own padding without anything having to store that union.
public struct AtlasPlateFrame: Equatable, Sendable {
    /// Where the folder sits, from the Map's root down. The DEEPEST folder of a folded run, which
    /// is the folder the files standing on the plate are really in.
    public let path: String

    /// What the plate is called: the last component, or the whole folded run written the way a
    /// path is — `macOS/Packages` for a folder that holds nothing but one folder.
    ///
    /// Stored rather than read off the path, because a folded plate is named for MORE than the
    /// folder it is at: the run above it has no plate of its own and this is where those folders
    /// are told to the reader.
    public let name: String

    public let rect: CGRect

    /// How far in from the root the folder sits, 0 at the root. The materials family gives three
    /// plate tones and repeats the deepest past that, so the tone is read off this number rather
    /// than counted again by whatever draws it.
    public let depth: Int

    /// A plate standing for one folder. The folded case is built by the tiler, which is the only
    /// thing that can see a run.
    public init(path: String, rect: CGRect, depth: Int) {
        self.init(path: path, name: AtlasPath.name(of: path), rect: rect, depth: depth)
    }

    public init(path: String, name: String, rect: CGRect, depth: Int) {
        self.path = path
        self.name = name
        self.rect = rect
        self.depth = depth
    }

    /// Every folder this plate stands for, outermost first and ending at `path`: the run it
    /// folded. One entry for a plate that folded nothing.
    ///
    /// The inverse of `name`, and how anything looking a folder up finds the plate it was drawn
    /// on — a folded folder has no plate of its own and is otherwise unreachable.
    public var covers: [String] {
        let parts = path.split(separator: "/")
        let folded = name.split(separator: "/").count
        return ((parts.count - folded) ..< parts.count)
            .map { parts[0 ... $0].joined(separator: "/") }
    }

    /// The strip along the top of the plate that the folder's name is drawn in — the room the
    /// plate kept for itself, above everything standing on it.
    ///
    /// Read off the frame rather than derived again by whatever draws the name: the strip shrinks
    /// with the plate, and a second copy of that arithmetic is a name landing across a file.
    public var nameStrip: CGRect {
        AtlasFraming.nameStrip(of: rect)
    }

    /// Whether the strip is the full height a name is set at, or was clamped away by a plate too
    /// small to spare the room.
    ///
    /// The clamp shrinks the strip with the plate, so past a point it holds a fraction of a line —
    /// and a name set in a fraction of a line is a row of clipped glyphs over the files under it.
    /// Whatever draws the name asks this rather than comparing heights of its own.
    public var carriesName: Bool {
        nameStrip.height >= AtlasFraming.plateHeader
    }
}
