import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// What a colour on the map means. A band is a function of the value AND of the repository it was
/// measured in, which is the whole reason red says anything: a thousand-line file is enormous in
/// one repository and ordinary in another.
@Suite("Atlas — banding a measure")
struct AtlasBandingTests {
    /// Ten files measuring 1 to 10, so a percentile is countable by hand.
    static func ladder() throws -> AtlasMap {
        let plots = (1 ... 10).map {
            #"{"kind": "plot", "name": "f\#($0)", "measures": {"lines": \#($0)}}"#
        }
        return try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "ladder", "children": [\(plots.joined(separator: ","))]}}
        """.utf8))
    }

    @Test func `a value bands by how much of the repository stands below it`() throws {
        let banding = try AtlasBanding(of: "lines", over: Self.ladder())

        // Five of ten below 6, which is the cut itself and therefore still quiet; nine below 10.
        #expect(banding.fraction(of: 6) == 0.5)
        #expect(banding.band(of: 6) == .quiet)
        #expect(banding.band(of: 9) == .middling)
        #expect(banding.band(of: 10) == .hot)
    }

    /// The reason the count is of what is STRICTLY below. 57 of the fixture's 89 files measure the
    /// same age, and counting ties in would put that whole mass at 0.64 and paint two thirds of the
    /// map amber for being ordinary.
    @Test func `a value the whole repository shares is quiet, not middling`() throws {
        let map = try AtlasMapFixture.argo()
        let banding = AtlasBanding(of: "age_in_weeks", over: map)

        let shared = map.plots.filter { $0.measures["age_in_weeks"] == 0 }
        #expect(shared.count > map.plots.count / 2)
        #expect(banding.band(of: 0) == .quiet)
    }

    /// Absent is not zero: a PNG has no lines to count rather than zero of them, and banding it as
    /// zero would draw it the quietest thing in the repository rather than unmeasured.
    @Test func `a file the repository never measured has no band`() throws {
        let map = try AtlasMapFixture.argo()
        let banding = AtlasBanding(of: "lines", over: map)

        #expect(banding.band(of: nil) == nil)
        let png = try AtlasMapFixture.plot(
            "argo/docs/designs/composer-picker/at-filter.png", in: map,
        )
        #expect(banding.band(of: png.measures["lines"]) == nil)
    }

    /// A point ON a cut belongs to the quieter band, which is `ArgoRamp.color(at:)`'s own
    /// arithmetic and the reason a repository sitting on a cut is not reported up.
    @Test(arguments: [
        (AtlasBand.middlingFrom, AtlasBand.quiet),
        (AtlasBand.middlingFrom + 0.0001, .middling),
        (AtlasBand.hotFrom, .middling),
        (AtlasBand.hotFrom + 0.0001, .hot),
    ])
    func `a value on a cut belongs to the quieter band`(at: Double, band: AtlasBand) {
        #expect(AtlasBand(at: at) == band)
    }

    @Test func `a measure nothing in the repository carries bands nothing`() throws {
        let banding = try AtlasBanding(of: "cyclomatic", over: AtlasMapFixture.argo())

        #expect(banding.fraction(of: 42) == 0)
        #expect(banding.band(of: 42) == .quiet)
    }
}
