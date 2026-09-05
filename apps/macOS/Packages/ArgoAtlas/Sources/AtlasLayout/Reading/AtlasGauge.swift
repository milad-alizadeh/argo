/// The one Measure a number cannot carry on its own, drawn against the repository it was measured
/// in (#1154).
///
/// 12 means nothing until you know it beats two files in three, so the banded Measure — the one
/// the map is coloured by — is shown on the same three bands the volumes are lit with, with the
/// file's own place among them. Every other Measure is a count or a date the reader already
/// understands, and the design is explicit that ranking those said nothing the number did not.
public struct AtlasGauge: Equatable, Sendable {
    /// The banded Measure, in the generator's own word for it — the same word the legend beside
    /// the map prints, because they are one reading of one channel.
    public let measure: String

    /// Where this file falls, or NOTHING where it carries no usable value for the Measure. Absent
    /// is not the bottom of the range: a needle standing at the left of the ramp is a measurement,
    /// and this file has none.
    public let placement: AtlasPlacement?

    public init(measure: String, placement: AtlasPlacement?) {
        self.measure = measure
        self.placement = placement
    }

    /// The gauge for one file, banded against the Map it is drawn in.
    ///
    /// The banding is taken over the Map AS DRAWN — the reader's filters already applied — for the
    /// legend's reason: a file's colour and the range it is read against have to come from the
    /// same distribution, or the panel describes a repository the map is not showing.
    public init(of measure: String, for plot: AtlasPlot, over banding: AtlasBanding) {
        self.init(
            measure: measure,
            placement: plot.value(of: measure).map {
                AtlasPlacement(value: $0, fraction: banding.fraction(of: $0))
            },
        )
    }
}

/// Where one value stands in one repository's own spread.
public struct AtlasPlacement: Equatable, Sendable {
    /// What the file measures, as the generator wrote it.
    public let value: Double

    /// The share of measured files in this repository standing STRICTLY below it — the needle's
    /// own position, and the number the reader is told in words underneath.
    ///
    /// Strictly below is `AtlasBanding`'s rule and not a second one: ties are the common case, and
    /// counting them in would put a whole shared mass most of the way up a gauge for being
    /// ordinary.
    public let fraction: Double

    /// Which of the three bands the file is drawn in, read off the same fraction the needle sits
    /// at — so the gauge and the volume on the map cannot disagree about the colour.
    public var band: AtlasBand {
        AtlasBand(at: fraction)
    }

    public init(value: Double, fraction: Double) {
        self.value = value
        self.fraction = fraction
    }
}
