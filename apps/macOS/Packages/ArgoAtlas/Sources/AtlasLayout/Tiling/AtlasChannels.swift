/// Which Measure drives which channel of the map — the reader's question, in the words of the
/// repository they asked it about.
///
/// The design's three, all of them turned (#1150). The Measure set is OPEN, so these are the
/// generator's own names and nothing validates them against a list — a name no Plot carries bands
/// nothing, tiles at the floor and stands at the floor, which is what an unmeasured repository
/// looks like.
public struct AtlasChannels: Equatable, Sendable {
    /// What a file's rectangle is sized by.
    public let footprint: String
    /// What it is coloured by.
    public let band: String
    /// What it stands as tall as. Read only by the city: at the flat camera every height is
    /// scaled to nothing, which is what makes the treemap the same picture whatever is on here.
    public let height: String

    public init(footprint: String, band: String, height: String) {
        self.footprint = footprint
        self.band = band
        self.height = height
    }

    /// One Measure on every channel — the opening reading, before anyone has chosen anything.
    public init(_ measure: String) {
        self.init(footprint: measure, band: measure, height: measure)
    }
}
