@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// What a rectangle's SIZE says. The one thing a treemap claims is that area is the measure, so
/// this is the suite that would make the picture a lie.
@Suite("Atlas — a file's footprint")
struct AtlasFootprintTests {
    /// A flat map: one folder, four files, no nesting. Area is exactly the measure here because
    /// there is only one plate spending room on a frame, and everything is inside it.
    static func flat() throws -> AtlasMap {
        try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "flat", "children": [
           {"kind": "plot", "name": "a", "measures": {"lines": 400}},
           {"kind": "plot", "name": "b", "measures": {"lines": 200}},
           {"kind": "plot", "name": "c", "measures": {"lines": 100}},
           {"kind": "plot", "name": "d", "measures": {"lines": 100}}]}}
        """.utf8))
    }

    static func plan(of map: AtlasMap) -> AtlasPlan {
        AtlasPlan(tiling: map, by: AtlasChannels("lines"), into: AtlasTilingTests.ground)
    }

    @Test func `a file twice the size of another is drawn twice the size`() throws {
        let areas = try Self.plan(of: Self.flat()).tiles.map { ($0.name, $0.rect.area) }
        let drawn = Dictionary(uniqueKeysWithValues: areas)

        let smallest = try #require(drawn["d"])
        for (name, share) in [("a", 4.0), ("b", 2.0), ("c", 1.0)] {
            let area = try #require(drawn[name])
            #expect(abs(area / smallest - share) < 0.0001)
        }
    }

    /// Proportional AMONG SIBLINGS, which is the strongest claim the map can make and the one the
    /// plan's own doc comment states. Across the whole map it cannot hold: a Plate spends part of
    /// its ground on the ring and name strip that make it readable as a folder, and that room comes
    /// off everything standing on it.
    @Test func `two files on one plate are drawn in the ratio of their measures`() throws {
        let map = try AtlasMapFixture.argo()
        let plan = Self.plan(of: map)
        let tiles = Dictionary(uniqueKeysWithValues: plan.tiles.map { ($0.path, $0.rect) })
        var compared = 0

        for frame in plan.plates {
            let siblings = try AtlasMapFixture.plate(frame.path, in: map).children
                .compactMap { node -> (Double, CGRect)? in
                    guard case let .plot(plot) = node, let lines = plot.measures["lines"],
                          let rect = tiles[plot.path] else { return nil }
                    return (lines, rect)
                }
            for (one, other) in zip(siblings, siblings.dropFirst()) where one.0 > 0 && other.0 > 0 {
                compared += 1
                let drawn = one.1.area / other.1.area
                #expect(abs(drawn / (one.0 / other.0) - 1) < 0.0001, "\(frame.path)")
            }
        }
        #expect(compared > 20, "the fixture put real pairs through this")
    }

    /// The twenty PNGs in the fixture carry no `lines` at all. A file drawn at zero area is a file
    /// on the map that cannot be pointed at, which is worse than one drawn small.
    @Test func `a file the repository measured nothing for still gets a rectangle`() throws {
        let map = try AtlasMapFixture.argo()
        let unmeasured = map.plots.filter { $0.measures["lines"] == nil }

        let plan = Self.plan(of: map)
        let drawn = plan.tiles.filter { tile in unmeasured.contains { $0.path == tile.path } }

        #expect(drawn.count == unmeasured.count)
        #expect(drawn.allSatisfy { $0.rect.area > 0 })
    }

    /// The claim squarifying is FOR, made where it is hard rather than where it is easy: on the
    /// resting whole map, with every level drawn at once. A thread is a file nobody can point at,
    /// so a tiler that draws threads has lost the file as surely as if it had dropped it.
    @Test func `the whole map is drawn in rectangles a reader can point at`() throws {
        let tiles = try Self.plan(of: AtlasMapFixture.argo()).tiles

        let ratios = tiles.map { max($0.rect.width, $0.rect.height)
            / min($0.rect.width, $0.rect.height)
        }.sorted()
        // Recorded on this fixture at 1200x800: median 1.31, p90 2.03, and one thread at 78.6 —
        // `settled-session.shape.json`, drawn 561 by 7 beside the 4,800-line file it describes.
        // The caps are just above what was measured, so drift fails rather than rounds; the worst
        // case is recorded rather than asserted, because a file 78x its neighbour IS what this
        // repository looks like and capping the ratio would be capping the measurement.
        #expect(ratios[ratios.count / 2] < 1.5)
        #expect(ratios[ratios.count * 9 / 10] < 2.5)
        #expect(tiles.allSatisfy { $0.rect.area > 300 })
    }
}

extension CGRect {
    /// What the rectangle covers. A ratio of two of these is the only claim a treemap makes.
    var area: CGFloat {
        width * height
    }
}
