import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// A folder holding nothing but one folder is not a place. It has no files to stand on it and no
/// choice to offer the reader, so a plate of its own spends a name strip on nothing and takes the
/// room off everything below it — seven of them in a row, in this repository, before the first
/// file is drawn.
///
/// So the chain folds into one plate carrying the whole run as its name, the way a path is written.
@Suite("Atlas — folders that hold only one folder")
struct AtlasFoldingTests {
    static let ground = CGSize(width: 1200, height: 800)

    static func plan(of map: AtlasMap) -> AtlasPlan {
        AtlasPlan(tiling: map, by: AtlasChannels("lines"), into: ground)
    }

    /// Three nested folders and one file at the bottom: one plate, named for the run.
    static func chain() throws -> AtlasMap {
        try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "argo", "children": [
           {"kind": "plate", "name": "apps", "children": [
             {"kind": "plate", "name": "macOS", "children": [
               {"kind": "plate", "name": "Packages", "children": [
                 {"kind": "plot", "name": "one.swift", "measures": {"lines": 40}}]}]}]},
           {"kind": "plot", "name": "README.md", "measures": {"lines": 10}}]}}
        """.utf8))
    }

    @Test func `a run of folders holding one folder is drawn as one plate`() throws {
        let plates = try Self.plan(of: Self.chain()).plates

        #expect(plates.map(\.name) == ["argo", "apps/macOS/Packages"])
    }

    /// The folded plate keeps the DEEPEST path, because that is the folder the files on it are in
    /// and the path is the join key everything downstream of the map runs on.
    @Test func `the folded plate is the folder its files are really in`() throws {
        let plan = try Self.plan(of: Self.chain())
        let folded = try #require(plan.plates.first { $0.depth == 1 })

        #expect(folded.path == "argo/apps/macOS/Packages")
        let file = try #require(plan.tiles.first)
        #expect(folded.rect.contains(file.rect))
    }

    /// And the run costs ONE level of nesting rather than three, which is what the fold is for: the
    /// plate tone, the frame and the name strip are all spent once.
    @Test func `a folded run is one level deep, not one level per folder`() throws {
        let plates = try Self.plan(of: Self.chain()).plates

        #expect(plates.map(\.depth) == [0, 1])
    }

    /// A folder holding one folder AND a file of its own is a place: the file has to stand
    /// somewhere, and folding would put it on a plate named for a folder it is not in.
    @Test func `a folder that also holds a file of its own is not folded`() throws {
        let map = try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "argo", "children": [
           {"kind": "plot", "name": "top.swift", "measures": {"lines": 30}},
           {"kind": "plate", "name": "inner", "children": [
             {"kind": "plot", "name": "deep.swift", "measures": {"lines": 30}}]}]}}
        """.utf8))

        let plates = Self.plan(of: map).plates

        #expect(plates.map(\.name) == ["argo", "inner"])
    }

    /// On the committed measurement the fold is worth seven name strips in one run, and it may not
    /// lose a folder while doing it: every Plate in the Map still appears in exactly one plate's
    /// name.
    @Test func `folding names every folder the repository has, once`() throws {
        let map = try AtlasMapFixture.argo()

        let plates = Self.plan(of: map).plates

        var folders: [String] = []
        func walk(_ plate: AtlasPlate) {
            folders.append(plate.path)
            for child in plate.children {
                guard case let .plate(nested) = child else { continue }
                walk(nested)
            }
        }
        walk(map.root)

        #expect(Set(plates.flatMap(\.covers)) == Set(folders))
        #expect(plates.count < folders.count, "the fixture put real runs through this")
    }
}
