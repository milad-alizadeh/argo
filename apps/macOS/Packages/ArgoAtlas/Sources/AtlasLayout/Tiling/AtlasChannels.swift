/// Which Measure drives which channel of the map — the reader's question, in the words of the
/// repository they asked it about.
///
/// The design's three, all of them turned (#1150). The Measure set is OPEN, so these are the
/// generator's own names and nothing validates them against a list — a name no Plot carries bands
/// nothing, tiles at the floor and stands at the floor, which is what an unmeasured repository
/// looks like.
public struct AtlasChannels: Equatable, Sendable, Codable {
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

    /// The reader's first reading of a Map nobody has chosen a channel on yet (#1161).
    ///
    /// TWO different Measures where the repository carries both, never one on every channel:
    /// with a single Measure driving both footprint and colour, nothing in the picture can be
    /// read off the colour that the size has not already said. `lines` over `bytes` for the
    /// footprint — alphabetical order alone puts `age_in_weeks` there, which sizes every file
    /// committed this week to nothing, and `bytes` is worse on a real repository: one outsized
    /// binary takes most of the map and everything else becomes a sliver. The height channel
    /// takes the band's Measure: a room drawing flat has no reading for it, only a name.
    public static func opening(for map: AtlasMap) -> AtlasChannels {
        let names = map.measureNames
        let footprint = ["lines", "bytes"].first { names.contains($0) } ?? names.first ?? ""
        let band = ["commits", "authors"].first { names.contains($0) } ?? footprint
        return AtlasChannels(footprint: footprint, band: band, height: band)
    }

    /// The same choice, with any channel naming a Measure this Map does not carry put back to the
    /// opening one.
    ///
    /// Spent at ONE seam only — where a choice restored from a previous session meets a freshly
    /// read Map (#1161) — and the type stays tolerant of an unknown name everywhere else, for the
    /// reason written at the top of this file. A menu cannot afford that tolerance: a `Picker`
    /// whose selection is absent from its own options draws blank, and a reader looking at a blank
    /// menu has no way to learn that the Measure it named is gone.
    public func held(over map: AtlasMap) -> AtlasChannels {
        let names = map.measureNames
        guard !names.contains(footprint) || !names.contains(band) || !names.contains(height) else {
            return self
        }
        let opening = AtlasChannels.opening(for: map)
        return AtlasChannels(
            footprint: names.contains(footprint) ? footprint : opening.footprint,
            band: names.contains(band) ? band : opening.band,
            height: names.contains(height) ? height : opening.height,
        )
    }
}
