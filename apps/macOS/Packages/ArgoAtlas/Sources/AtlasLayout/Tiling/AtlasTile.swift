import CoreGraphics

/// One Plot, placed: where the file is drawn and which band it is drawn in.
///
/// It carries the path rather than the Plot, because the path is the join key the whole Atlas runs
/// on — search, picking and opening in an editor all key off it — and because a plan that copied
/// the measures would be a second copy of the Map to keep in step.
public struct AtlasTile: Equatable, Sendable {
    public let path: String
    public let rect: CGRect

    /// Nothing when the Plot carries no value for the banded Measure. Absent is not zero: the
    /// twenty PNGs in the fixture have no lines to count, and a map that banded them as zero would
    /// draw them the quietest thing in the repository rather than unmeasured.
    public let band: AtlasBand?

    /// How tall the file stands, in the same points the rect is in — the third channel (#1150).
    ///
    /// Resolved here rather than left as a share for the renderer to scale, so the plan is the one
    /// place that decides what the map looks like: a renderer holding a ceiling of its own is a
    /// second copy of the arithmetic, and the two would disagree the first time a room resized.
    ///
    /// A tiled plan never puts zero here: `AtlasElevation.floor(of:)` is what a file measuring
    /// nothing stands, and says why. Zero is what a plan WRITTEN BY HAND defaults to, and it is
    /// honest there — a flat map is what the flat camera draws whatever is on this channel.
    public let height: CGFloat

    /// Which Domain the file was placed in, on a map tiled by domain — and NOTHING on a map tiled
    /// by folder (#1158).
    ///
    /// Two readings of one rectangle, and only ever one at a time: the band is what the file
    /// measures and the Domain is what somebody guessed it is about, so a tile carrying both would
    /// be a rectangle with two claims on its colour and nothing to say which won.
    public let domain: AtlasTileDomain?

    /// A file on a map tiled by FOLDER: painted by what it measures.
    public init(path: String, rect: CGRect, band: AtlasBand?, height: CGFloat = 0) {
        self.path = path
        self.rect = rect
        self.band = band
        self.height = height
        self.domain = nil
    }

    /// A file on a map tiled by DOMAIN: painted by what somebody guessed it is about (#1158).
    ///
    /// A second initializer rather than a fifth parameter, and not only because the cap is four:
    /// the two readings are exclusive, and two initializers is what makes that structural. A tile
    /// carrying a band AND a domain would be a rectangle with two claims on its colour and nothing
    /// to say which won, and no caller can build one.
    public init(path: String, rect: CGRect, domain: AtlasTileDomain, height: CGFloat = 0) {
        self.path = path
        self.rect = rect
        self.band = nil
        self.height = height
        self.domain = domain
    }

    /// What the file is called on disk.
    public var name: String {
        AtlasPath.name(of: path)
    }
}
