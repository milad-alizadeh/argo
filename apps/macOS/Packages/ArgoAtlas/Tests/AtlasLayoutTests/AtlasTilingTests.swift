import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// Where a measured repository is drawn. The claims are the ones a reader would make with their
/// eyes on the map: nothing on top of anything else, every file on its own folder's plate, a file
/// twice the size drawn twice the size, and the same repository in the same places every time.
///
/// Every claim is made against the RESTING WHOLE MAP rather than inside one folder. A tiling whose
/// cost is "one level looks slightly worse" becomes "the deep half of the tree is not drawn" when
/// every level is drawn at once: a canonical-frame variant of this tiler delivered its promised
/// aspect ratios inside a folder and, on the whole map, lost 532 of 1,483 files (#1146).
@Suite("Atlas — the tiled map")
struct AtlasTilingTests {
    /// Big enough that the fixture's eleven levels of nesting all still have room, which is the
    /// condition the interesting failures live under.
    static let ground = CGSize(width: 1200, height: 800)

    /// Size by lines and colour by commits: two different Measures, so a claim about one channel
    /// cannot pass by reading the other's number.
    static let channels = AtlasChannels(footprint: "lines", band: "commits", height: "commits")

    static func plan(of map: AtlasMap) -> AtlasPlan {
        AtlasPlan(tiling: map, by: channels, into: ground)
    }

    @Test func `every file in the map is somewhere on it`() throws {
        let map = try AtlasMapFixture.argo()

        let plan = Self.plan(of: map)

        #expect(Set(plan.tiles.map(\.path)) == Set(map.plots.map(\.path)))
    }

    @Test func `no two file rectangles overlap`() throws {
        let rects = try Self.plan(of: AtlasMapFixture.argo()).tiles.map(\.rect)

        for (at, rect) in rects.enumerated() {
            for other in rects[(at + 1)...] {
                #expect(!rect.intersects(other))
            }
        }
    }

    @Test func `every file stands on the plate of the folder it is in`() throws {
        let plan = try Self.plan(of: AtlasMapFixture.argo())
        let plates = Dictionary(uniqueKeysWithValues: plan.plates.map { ($0.path, $0.rect) })

        for tile in plan.tiles {
            let folder = String(tile.path.dropLast(tile.name.count + 1))
            let plate = try #require(plates[folder], "\(tile.path) has a plate to stand on")
            #expect(plate.contains(tile.rect))
        }
    }

    /// And a folder stands on ITS folder's plate. Without this a nested plate could escape its
    /// parent and take every file under it out with nothing above saying so — the shape of the
    /// failure that lost 532 files, one level up from where the test above looks.
    @Test func `every folder stands on the plate of the folder it is in`() throws {
        let plan = try Self.plan(of: AtlasMapFixture.argo())
        let plates = Self.grounds(in: plan)
        var nested = 0

        for frame in plan.plates where frame.depth > 0 {
            // The folder holding the OUTERMOST folder this plate stands for: a folded run has no
            // plate above it until the fold began.
            let outermost = try #require(frame.covers.first)
            let folder = String(outermost.dropLast(AtlasPath.name(of: outermost).count + 1))
            let parent = try #require(plates[folder], "\(frame.path) has a plate to stand on")
            nested += 1
            #expect(parent.contains(frame.rect), "\(frame.path)")
        }
        #expect(nested > 15, "the fixture put real folders through this")
    }

    /// The failure this guards is a dictionary iterated in its own order, whose seed is fresh on
    /// every launch — which is how a map comes out different every time it is opened. Decoded
    /// TWICE rather than tiled twice: one value tiled twice would agree even if the walk read a
    /// measure bag in its own order, because it would be reading the same bag both times.
    @Test func `the same map file tiles identically twice`() throws {
        let plan = try Self.plan(of: AtlasMapFixture.argo())

        #expect(try plan == Self.plan(of: AtlasMapFixture.argo()))
    }

    /// What makes the order above TOTAL. Swift's sort is not documented as stable, so two files of
    /// equal weight would otherwise be ordered by whatever the sort happened to do with them.
    @Test func `two files of the same size are placed in the order of their paths`() throws {
        let map = try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "tie", "children": [
           {"kind": "plot", "name": "zebra", "measures": {"lines": 10}},
           {"kind": "plot", "name": "aardvark", "measures": {"lines": 10}}]}}
        """.utf8))

        #expect(Self.plan(of: map).tiles.map(\.name) == ["aardvark", "zebra"])
    }

    /// A plate IS its children plus its own padding, so nothing has to store that union and nothing
    /// can come to disagree with it. Asserted against the plate's own edges rather than against
    /// `AtlasMeasure.interior` — a test that inset the rect the same way the tiler did would pass
    /// on a tiler that spent no padding at all.
    @Test func `a plate is the ground its children cover, plus its own padding`() throws {
        let map = try AtlasMapFixture.argo()
        let plan = Self.plan(of: map)
        var checked = 0

        for frame in plan.plates {
            let plate = try AtlasMapFixture.plate(frame.path, in: map)
            guard !plate.children.isEmpty else { continue }
            checked += 1
            let covered = Self.rects(of: plate.children, in: plan).reduce(CGRect.null) {
                $0.union($1)
            }
            let ring = covered.minX - frame.rect.minX
            #expect(ring > 0, "\(frame.path)")
            // The same ring on the two sides and the foot, and MORE at the head: that extra is the
            // strip the folder's name is drawn in, and a plate with no room for its name is a plate
            // carrying a label nothing can read.
            #expect(Self.about(frame.rect.maxX - covered.maxX, ring), "\(frame.path)")
            #expect(Self.about(frame.rect.maxY - covered.maxY, ring), "\(frame.path)")
            #expect(covered.minY - frame.rect.minY > ring, "\(frame.path)")
        }
        #expect(checked > 15, "the fixture put real plates through this")
    }

    @Test func `a plate carries the name of its folder`() throws {
        let plan = try Self.plan(of: AtlasMapFixture.argo())

        let atlas = try #require(plan.plates.first {
            $0.path == "argo/apps/macOS/Packages/ArgoAtlas"
        })
        #expect(atlas.name == "ArgoAtlas")
        // 2, not 4: `apps/macOS/Packages` is one folded plate rather than three.
        #expect(atlas.depth == 2)
    }

    /// The rect of each of a plate's direct children, in that plate's order.
    static func rects(of children: [AtlasNode], in plan: AtlasPlan) -> [CGRect] {
        let tiles = Dictionary(uniqueKeysWithValues: plan.tiles.map { ($0.path, $0.rect) })
        let plates = grounds(in: plan)
        return children.compactMap { tiles[$0.path] ?? plates[$0.path] }
    }

    /// The rect a folder is drawn on, keyed by EVERY folder each plate stands for — a folder
    /// folded into the plate below it has no plate of its own to be found under.
    static func grounds(in plan: AtlasPlan) -> [String: CGRect] {
        Dictionary(uniqueKeysWithValues: plan.plates.flatMap { frame in
            frame.covers.map { ($0, frame.rect) }
        })
    }

    /// Equal to within a thousandth of a point — well under anything a screen can draw, and well
    /// over the drift of a few thousand multiplications.
    static func about(_ one: CGFloat, _ other: CGFloat) -> Bool {
        abs(one - other) < 0.001
    }
}
