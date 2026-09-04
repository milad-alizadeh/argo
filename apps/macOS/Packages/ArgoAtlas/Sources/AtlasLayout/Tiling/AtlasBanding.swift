/// One Measure's distribution across a whole Map, and the band a value falls in against it.
///
/// Banding is a function of the value AND of the repository it was measured in, which is the whole
/// reason red means anything: a thousand-line file is enormous in one repository and ordinary in
/// another, and a fixed threshold would say the same thing about both.
public struct AtlasBanding: Equatable, Sendable {
    /// Every value the Map measures for this Measure, ascending.
    ///
    /// A Plot that does not carry the Measure is ABSENT rather than zero — a PNG has no lines to
    /// count rather than zero of them — so it is left out of the distribution instead of dragging
    /// its bottom down. So is a value no rectangle can be made from; `AtlasReading` is where both
    /// are judged.
    private let ascending: [Double]

    public init(of measure: String, over map: AtlasMap) {
        self.ascending = map.values(of: measure).sorted()
    }

    /// Where a value sits in the repository's own distribution: the share of measured Plots
    /// standing STRICTLY below it, so the bottom of the distribution is 0 rather than its own mass.
    ///
    /// Strictly below rather than at-or-below because ties are the common case, not the corner: 57
    /// of the fixture's 89 files measure the same `age_in_weeks`. At-or-below would put that whole
    /// mass at 0.64 and paint two thirds of the map amber for being ordinary.
    public func fraction(of value: Double) -> Double {
        guard !ascending.isEmpty else { return 0 }
        return Double(countBelow(value)) / Double(ascending.count)
    }

    /// The band a value falls in, or nothing when the Plot was never measured for it.
    public func band(of value: Double?) -> AtlasBand? {
        guard let value else { return nil }
        return AtlasBand(at: fraction(of: value))
    }

    /// The lower bound, by bisection. Every Plot is banded once against a list as long as the
    /// repository, so a linear scan here is the map's cost squared.
    private func countBelow(_ value: Double) -> Int {
        var low = 0
        var high = ascending.count
        while low < high {
            let middle = low + (high - low) / 2
            if ascending[middle] < value {
                low = middle + 1
            } else {
                high = middle
            }
        }
        return low
    }
}
