@testable import AtlasLayout
import Foundation
import Testing

/// Hiding test files changes what the repository IS for the purposes of the reading — it is not a
/// visibility toggle over an unchanged map (#1161).
@Suite("Atlas — hiding test files")
struct AtlasMapFilteringTests {
    /// Two plates: ten product files measuring 1 to 10 lines, so a percentile is countable by
    /// hand, and one test file measuring 1000 — an outlier the ladder alone could never produce,
    /// which is what makes filtering it move the range rather than leave it where it was.
    private static func map() -> AtlasMap {
        let product = (1 ... 10).map {
            AtlasNode.plot(AtlasPlot(
                path: "root/Sources/f\($0).swift",
                measures: ["lines": Double($0)],
            ))
        }
        return AtlasMap(
            measuredAt: Date(),
            commit: nil,
            root: AtlasPlate(path: "root", children: [
                .plate(AtlasPlate(path: "root/Sources", children: product)),
                .plate(AtlasPlate(path: "root/Tests", children: [
                    .plot(AtlasPlot(
                        path: "root/Tests/WidgetTests.swift",
                        measures: ["lines": 1000],
                    )),
                ])),
            ]),
            couplings: [
                AtlasCoupling(
                    first: "root/Sources/f1.swift",
                    second: "root/Sources/f2.swift",
                    strength: 0.5,
                ),
                AtlasCoupling(
                    first: "root/Sources/f1.swift",
                    second: "root/Tests/WidgetTests.swift",
                    strength: 0.9,
                ),
            ],
        )
    }

    @Test func `a test plot is removed`() {
        let filtered = Self.map().excludingTestFiles()

        #expect(!filtered.plots.contains { $0.path == "root/Tests/WidgetTests.swift" })
        #expect(filtered.plots.contains { $0.path == "root/Sources/f1.swift" })
    }

    @Test func `a plate left with nothing standing on it is removed too`() {
        let filtered = Self.map().excludingTestFiles()

        #expect(!filtered.root.children.contains { $0.path == "root/Tests" })
    }

    /// The root is the one Plate that survives with nothing on it — a Map with no product files is
    /// still a Map, and every downstream caller already draws that as an empty floor.
    @Test func `the root survives even where nothing is left standing`() {
        let allTests = AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(
            path: "root",
            children: [.plot(AtlasPlot(path: "root/WidgetTests.swift", measures: ["lines": 10]))],
        ))

        let filtered = allTests.excludingTestFiles()

        #expect(filtered.root.path == "root")
        #expect(filtered.plots.isEmpty)
    }

    /// A Coupling naming a Plot the filter removed would tie a reader to a file no longer on the
    /// map — dropped rather than left dangling.
    @Test func `a coupling naming a removed file is dropped with it`() {
        let filtered = Self.map().excludingTestFiles()

        #expect(filtered.couplings.count == 1)
        #expect(filtered.couplings[0].second == "root/Sources/f2.swift")
    }

    /// This is the whole reason the filter re-reads the repository rather than only hiding drawn
    /// tiles: with the test file gone, the range the colour band is cut against shrinks, so the
    /// legend's own numbers move even though not one product file changed. Ten below the outlier,
    /// eleven files altogether — 10/11 stand below 1000, over the hot cut, so it alone holds the
    /// hot band before the filter runs.
    @Test func `removing the outlying test file changes the range the legend reports`() {
        let unfiltered = Self.map()
        let filtered = unfiltered.excludingTestFiles()

        let before = AtlasLegend(
            measure: "lines",
            over: AtlasBanding(of: "lines", over: unfiltered),
        )
        let after = AtlasLegend(measure: "lines", over: AtlasBanding(of: "lines", over: filtered))

        #expect(before.leastHot == 1000)
        #expect(after.leastHot == 10)
    }
}
