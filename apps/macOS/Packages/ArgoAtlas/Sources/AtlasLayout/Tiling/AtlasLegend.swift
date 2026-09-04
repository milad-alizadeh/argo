/// The key beside the map: which Measure the colour is, and what a value is worth at each end of
/// the ramp.
///
/// Both ends are read off the banding the tiles were coloured by rather than taken again from the
/// distribution, because a legend with arithmetic of its own is a key the map can disagree with —
/// and the reader would believe the key.
public struct AtlasLegend: Equatable, Sendable {
    /// The Measure the map is coloured by, in the generator's own word for it.
    public let measure: String

    /// The last value still drawn quiet — the head of the green half of the repository. Nothing
    /// when no Plot measured anything for this Measure.
    public let greatestQuiet: Double?

    /// The first value drawn hot — the foot of the red top of the repository.
    public let leastHot: Double?

    public init(measure: String, greatestQuiet: Double?, leastHot: Double?) {
        self.measure = measure
        self.greatestQuiet = greatestQuiet
        self.leastHot = leastHot
    }

    /// The key for one Measure over one repository's own spread.
    ///
    /// Each end is searched in the banding rather than computed from a percentile, so the two
    /// numbers the legend prints are values the map really drew in that band.
    public init(measure: String, over banding: AtlasBanding) {
        self.init(
            measure: measure,
            greatestQuiet: banding.greatest(in: .quiet),
            leastHot: banding.least(in: .hot),
        )
    }
}
