import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// What the key beside the map claims. A legend naming a number the map is not coloured by would
/// be worse than no legend at all, because the reader would believe it.
///
/// So both ends are read off the SAME banding every tile is coloured by, and the claims below are
/// that the value at each end is the last one on its own side of the cut.
@Suite("Atlas — the legend")
struct AtlasLegendTests {
    @Test func `the legend names the measure the map is coloured by`() throws {
        let plan = try AtlasPlan(
            tiling: AtlasMapFixture.argo(),
            by: AtlasChannels(footprint: "lines", band: "commits"),
            into: CGSize(width: 1200, height: 800),
        )

        #expect(plan.legend?.measure == "commits")
    }

    /// Ten files measuring 1 to 10: five stand below 6, so 6 is the last quiet value, and nine
    /// stand below 10, so 10 is the first hot one. Countable by hand, which is the point.
    @Test func `each end is the last value on its own side of the cut`() throws {
        let banding = try AtlasBanding(of: "lines", over: AtlasBandingTests.ladder())

        let legend = AtlasLegend(measure: "lines", over: banding)

        #expect(legend.greatestQuiet == 6)
        #expect(legend.leastHot == 10)
    }

    /// The two ends and the map's colours are one decision, read one way. The failure this guards
    /// is a legend computed from arithmetic of its own — a percentile taken a second time, rounded
    /// the other way — which draws a key the map disagrees with and says so nowhere.
    @Test func `every end the legend names bands the way the map bands it`() throws {
        let map = try AtlasMapFixture.argo()

        for measure in map.measureNames {
            let banding = AtlasBanding(of: measure, over: map)
            let legend = AtlasLegend(measure: measure, over: banding)

            if let quiet = legend.greatestQuiet {
                #expect(banding.band(of: quiet) == .quiet, "\(measure)")
            }
            if let hot = legend.leastHot {
                #expect(banding.band(of: hot) == .hot, "\(measure)")
            }
        }
    }

    /// A repository that measured nothing for the banded Measure has no end to name. Nothing
    /// rather than zero, for the reason a file carrying no value bands to nothing: a legend
    /// reading "0 to 0" is a claim about a repository nobody measured.
    @Test func `a measure nothing carries names no value at either end`() throws {
        let banding = try AtlasBanding(of: "cyclomatic", over: AtlasMapFixture.argo())

        let legend = AtlasLegend(measure: "cyclomatic", over: banding)

        #expect(legend.greatestQuiet == nil)
        #expect(legend.leastHot == nil)
    }

    /// The map of a repository nothing has been scanned from has no key either — and asking for
    /// one anyway is how a view comes to draw an empty ramp over an empty floor.
    @Test func `the empty map has no legend`() {
        #expect(AtlasPlan.empty.legend == nil)
    }
}
