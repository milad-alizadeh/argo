import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// What a volume's HEIGHT says — the third channel, and the one a treemap has no room for (#1150).
///
/// Area is checked next door in `AtlasFootprintTests`; this is the same claim about the other
/// measure. It matters for the same reason: a reader comparing two towers is reading a ratio, and
/// a height that is not proportional to its Measure is a picture that lies at a glance.
@Suite("Atlas — how tall a file stands")
struct AtlasElevationTests {
    /// A flat map measured on TWO Measures, so a height read off the wrong one is visible: `lines`
    /// and `commits` order the four files differently on purpose, and `d` carries no `lines` at
    /// all — the case the fixture's twenty PNGs are.
    static func flat() throws -> AtlasMap {
        try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "flat", "children": [
           {"kind": "plot", "name": "a", "measures": {"lines": 400, "commits": 10}},
           {"kind": "plot", "name": "b", "measures": {"lines": 200, "commits": 20}},
           {"kind": "plot", "name": "c", "measures": {"lines": 100, "commits": 5}},
           {"kind": "plot", "name": "d", "measures": {"commits": 3}}]}}
        """.utf8))
    }

    static let ground = CGSize(width: 800, height: 600)
    static let ceiling = AtlasElevation.ceiling(of: AtlasElevationTests.ground)
    static let floor = AtlasElevation.floor(of: AtlasElevationTests.ground)

    static func heights(of map: AtlasMap, by channels: AtlasChannels) -> [String: CGFloat] {
        let plan = AtlasPlan(tiling: map, by: channels, into: Self.ground)
        return Dictionary(uniqueKeysWithValues: plan.tiles.map { ($0.name, $0.height) })
    }

    @Test func `the file measuring most stands at the ceiling`() throws {
        let heights = try Self.heights(of: Self.flat(), by: AtlasChannels("lines"))

        #expect(heights["a"] == Self.ceiling)
    }

    @Test func `a file measuring half as much stands half as tall`() throws {
        let heights = try Self.heights(of: Self.flat(), by: AtlasChannels("lines"))

        let tallest = try #require(heights["a"])
        let half = try #require(heights["b"])
        #expect(abs(half / tallest - 0.5) < 0.0001)
    }

    /// The third channel is its own Measure. Read off `lines` this file is the middle of the three
    /// measured; read off `commits` it is the tallest, so a tiler that quietly heighted by the
    /// footprint reds here rather than drawing a plausible wrong city.
    @Test func `height is read off its own measure, not off the footprint`() throws {
        let channels = AtlasChannels(footprint: "lines", band: "lines", height: "commits")

        let heights = try Self.heights(of: Self.flat(), by: channels)

        #expect(heights["b"] == Self.ceiling)
    }

    /// Absent is not zero, and a file at zero height is a file that vanishes into the plate it
    /// stands on. It keeps the floor instead: the shallowest slab the map draws, which reads as a
    /// flat tile rather than as the least of something.
    @Test func `a file the measure never reached stands at the floor`() throws {
        let heights = try Self.heights(of: Self.flat(), by: AtlasChannels("lines"))

        #expect(heights["d"] == Self.floor)
    }

    /// A Measure NO Plot carries has no tallest to divide by. Every file keeps the floor, which is
    /// the flat map — rather than a division by zero reaching the shader as a NaN, where a whole
    /// city disappears and nothing says why.
    @Test func `a measure nothing carries stands the whole map at the floor`() throws {
        let channels = AtlasChannels(footprint: "lines", band: "lines", height: "unmeasured")

        let heights = try Self.heights(of: Self.flat(), by: channels)

        #expect(heights.count == 4)
        #expect(heights.values.allSatisfy { $0 == Self.floor })
    }

    /// The committed measurement, which is where a height can go wrong at a scale the invented
    /// maps above cannot reach: 89 files, one of them 78× the median, and twenty carrying no
    /// `lines` at all.
    @Test func `no file in the real repository stands outside the two ends`() throws {
        let map = try AtlasMapFixture.argo()

        let plan = AtlasPlan(tiling: map, by: AtlasChannels("lines"), into: Self.ground)

        #expect(plan.tiles.allSatisfy { $0.height >= Self.floor })
        #expect(plan.tiles.allSatisfy { $0.height <= Self.ceiling })
        #expect(plan.tiles.contains { $0.height == Self.ceiling })
    }
}
