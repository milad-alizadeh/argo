/// One line of the list beside a domain map: a region, said the way a list says it (#1158).
///
/// The sibling of `AtlasIndexEntry`, and a different type rather than a case of it because the two
/// rows say different things: a file row carries a folder and a measured value, and a region row
/// carries a colour and a population. Nothing sensible reads a folder off a subject.
public struct AtlasDomainEntry: Equatable, Sendable {
    /// The Plate the region was tiled as — the path a click on this row goes to, and the same
    /// string the map picks that region by.
    public let path: String

    /// The Domain's place in the inference's own order, largest first. Its COLOUR, in the one
    /// sense that matters: the wheel is walked by this and nothing else, so the swatch on this row
    /// is the colour of that region on the map.
    public let rank: Int

    /// How surely the Domain holds its files on average — what the swatch is washed out by, the
    /// way every file on the map is washed out by its own.
    public let confidence: Double

    /// How many files are in it. The number a reader scans this list for: a subject spread over
    /// five folders is invisible in a tree and is one row with a count here.
    public let count: Int

    public init(path: String, rank: Int, confidence: Double, count: Int) {
        self.path = path
        self.rank = rank
        self.confidence = confidence
        self.count = count
    }

    /// What the inference called it: the token most concentrated in its files.
    ///
    /// Read off the path rather than stored beside it, the way every other name in this package
    /// is: `AtlasMap.regrouped()` hangs the region's name off the Map's own root, so the two
    /// cannot come to disagree about a Domain the inference named twice.
    public var name: String {
        AtlasPath.name(of: path)
    }
}
