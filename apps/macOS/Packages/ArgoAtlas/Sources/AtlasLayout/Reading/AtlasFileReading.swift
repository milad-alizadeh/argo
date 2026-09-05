/// What is said about one file when a reader opens it beside the map (#1154).
///
/// Everything the panel draws, decided here: which facts are stated plainly, where the banded
/// Measure puts this file among the others, and what is left to list. The panel itself spells the
/// words and places the pixels and decides nothing — which is what lets the whole reading be
/// asserted on without a window, the way `AtlasPlan` is.
///
/// It is a reading of a Map, never of a plan: a plan holds rectangles and a reader asked about a
/// file. The join between the two is the path, which is the key the whole Atlas runs on.
public struct AtlasFileReading: Equatable, Sendable {
    /// The Plot's path, exactly as the Map holds it.
    public let path: String

    /// The four plain facts, always all four and always in this order — a reading that dropped the
    /// ones a file has no value for would tell one file more than another and leave the reader to
    /// notice the gap.
    public let facts: [AtlasFactReading]

    /// The banded Measure, against this repository's own spread.
    public let gauge: AtlasGauge

    /// Every other Measure the Map carries, sorted as the Map sorts them.
    public let rows: [AtlasMeasureRow]

    public init(
        path: String,
        facts: [AtlasFactReading],
        gauge: AtlasGauge,
        rows: [AtlasMeasureRow],
    ) {
        self.path = path
        self.facts = facts
        self.gauge = gauge
        self.rows = rows
    }

    /// What the file is called on disk.
    public var name: String {
        AtlasPath.name(of: path)
    }

    /// The reading of one file of a Map, through the channels the map is drawn by — or NOTHING
    /// where the Map holds no file at that path.
    ///
    /// Nothing rather than an empty reading, because the two are different instructions: a panel
    /// with no numbers in it says the file was never measured, and a reader who clicked a volume
    /// that is on the map has hit neither case. The Map handed in is the Map AS DRAWN, filters
    /// already applied, so every range quoted here is the range the picture beside it was banded
    /// against.
    public init?(of path: String, in map: AtlasMap, by channels: AtlasChannels) {
        guard let plot = map.plots.first(where: { $0.path == path }) else { return nil }
        let drawn: Set<String> = [channels.footprint, channels.height]
        let facts: [AtlasFactReading] = AtlasFact.allCases.map { fact in
            AtlasFactReading(fact: fact, value: plot.value(of: fact.measure))
        }
        let banding = AtlasBanding(of: channels.band, over: map)
        let listed: [String] = map.measureNames.filter { name in
            name != channels.band && AtlasFact(rawValue: name) == nil
        }
        let rows: [AtlasMeasureRow] = listed.map { name in
            AtlasMeasureRow(
                measure: name, value: plot.value(of: name), isDrawn: drawn.contains(name),
            )
        }
        self.init(
            path: plot.path,
            facts: facts,
            gauge: AtlasGauge(of: channels.band, for: plot, over: banding),
            rows: rows,
        )
    }
}

/// One Measure of a file that is neither a plain fact nor the banded one: its name, its value, and
/// whether the map the reader is looking at is drawn by it.
public struct AtlasMeasureRow: Equatable, Sendable {
    public let measure: String

    /// Nothing where this file carries no usable value for it — the twenty PNGs in the fixture
    /// have no lines to count, and a row reading zero would say they were measured and found
    /// empty.
    public let value: Double?

    /// Whether this Measure drives the footprint or the height of the map as drawn. The row is
    /// marked for it, because a reader comparing two numbers is owed the fact that one of them is
    /// what they are looking at.
    public let isDrawn: Bool

    public init(measure: String, value: Double?, isDrawn: Bool) {
        self.measure = measure
        self.value = value
        self.isDrawn = isDrawn
    }
}
