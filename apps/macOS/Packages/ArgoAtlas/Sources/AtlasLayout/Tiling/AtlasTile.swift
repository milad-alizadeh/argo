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

    public init(path: String, rect: CGRect, band: AtlasBand?) {
        self.path = path
        self.rect = rect
        self.band = band
    }

    /// What the file is called on disk.
    public var name: String {
        AtlasPath.name(of: path)
    }
}
