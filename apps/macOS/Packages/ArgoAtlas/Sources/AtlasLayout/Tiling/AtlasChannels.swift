/// Which Measure drives which channel of the map — the reader's question, in the words of the
/// repository they asked it about.
///
/// Two channels rather than the design's three: height is what #1150 stands the volumes up with,
/// and a field for it here would be a knob nothing turns until then. The Measure set is OPEN, so
/// these are the generator's own names and nothing validates them against a list — a name no Plot
/// carries bands nothing and tiles at the floor, which is what an unmeasured repository looks like.
public struct AtlasChannels: Equatable, Sendable {
    /// What a file's rectangle is sized by.
    public let footprint: String
    /// What it is coloured by.
    public let band: String

    public init(footprint: String, band: String) {
        self.footprint = footprint
        self.band = band
    }

    /// One Measure on both channels — the opening reading, before anyone has chosen anything.
    public init(_ measure: String) {
        self.init(footprint: measure, band: measure)
    }
}
