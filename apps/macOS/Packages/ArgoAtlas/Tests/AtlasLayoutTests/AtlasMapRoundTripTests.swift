import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// A Map written out and read back is the Map that went in.
///
/// The claim that keeps the reader and the generator one shape rather than two: the generator
/// writes what this reads, and a key either of them spells differently is caught here.
@Suite("Atlas — a Map survives being written and read again")
struct AtlasMapRoundTripTests {
    @Test func `a real measurement comes back whole`() throws {
        let map = try AtlasMapFixture.argo()
        #expect(try AtlasMap(decoding: map.encoded()) == map)
    }

    @Test func `writing one Map twice writes one set of bytes`() throws {
        // Keys are sorted for this: a measure bag walked in its own order writes different bytes
        // every run, and app data that changes when nothing was measured looks like a rebuild.
        let map = try AtlasMapFixture.argo()
        #expect(try map.encoded() == map.encoded())
    }

    @Test func `a Map built in memory comes back with the same paths`() throws {
        // Paths are derived on the way in and dropped on the way out, so this is the one claim
        // that the nesting written is the nesting the paths described.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 1_756_951_037),
            commit: "4478553",
            root: AtlasPlate(path: "argo", children: [
                .plate(AtlasPlate(path: "argo/rules", children: [
                    .plot(AtlasPlot(path: "argo/rules/house.md", measures: ["lines": 45])),
                ])),
                .plot(AtlasPlot(path: "argo/AGENTS.md", measures: [:])),
            ]),
        )
        #expect(try AtlasMap(decoding: map.encoded()) == map)
    }

    @Test func `a Map stamped to the fraction comes back as the same Map`() throws {
        // A generator stamps `measuredAt` with `Date()`. ISO 8601 as written here carries no
        // fraction, so a Map that kept one would read back different from the Map written, on the
        // one field a later ticket reads for staleness.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 1_756_951_037.813_5),
            commit: nil,
            root: AtlasPlate(path: "argo", children: []),
        )
        #expect(map.measuredAt == Date(timeIntervalSince1970: 1_756_951_037))
        #expect(try AtlasMap(decoding: map.encoded()) == map)
    }

    @Test func `a node whose path is not the one its Plate gives it is refused`() throws {
        // Names are cut off paths on the way out. Taken from the path alone, a Plot hung two
        // levels below the Plate its path names would come back re-parented one level up, and the
        // Map read would be a Map of a repository that does not exist.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/rules/house.md", measures: [:])),
            ]),
        )
        #expect(throws: AtlasMapError.misplacedNode("argo/rules/house.md")) {
            try map.encoded()
        }
    }

    @Test func `a root whose path is more than its own name is refused`() throws {
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "Users/milad/argo", children: []),
        )
        #expect(throws: AtlasMapError.misplacedNode("Users/milad/argo")) {
            try map.encoded()
        }
    }

    @Test func `the couplings come back naming the same two files`() throws {
        // Couplings are written as positions in the Plot order and read back as paths, so this is
        // the one claim that a tie drawn on the map joins the files the counting joined.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 1_756_951_037),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
                .plate(AtlasPlate(path: "argo/rules", children: [
                    .plot(AtlasPlot(path: "argo/rules/house.md", measures: [:])),
                ])),
            ]),
            couplings: [AtlasCoupling(
                first: "argo/a.swift", second: "argo/rules/house.md", strength: 0.5,
            )],
        )
        #expect(try AtlasMap(decoding: map.encoded()) == map)
    }

    @Test func `a Map file written before couplings were counted reads as none`() throws {
        // The field is absent from every Map file this repository wrote before #1149, and those
        // are valid measurements: a reader that refused them would fail on app data it wrote.
        let json = #"{"version":1,"measuredAt":"2026-09-04T00:37:17Z","commit":null,"#
            + #""root":{"name":"argo","children":[]}}"#
        #expect(try AtlasMap(decoding: Data(json.utf8)).couplings.isEmpty)
    }

    @Test func `a coupling naming a file the Map does not hold is refused`() throws {
        // A caller can build one, and writing it would put a position in the file that means a
        // different file on the way back in.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
            ]),
            couplings: [AtlasCoupling(first: "argo/a.swift", second: "argo/b.swift", strength: 1)],
        )
        #expect(throws: AtlasMapError.danglingCoupling("argo/a.swift / argo/b.swift")) {
            try map.encoded()
        }
    }

    @Test func `a measure JSON cannot spell is refused rather than written`() throws {
        // A generator that divided by zero reaches here, and a file half-written to app data is
        // worse than a write that did not happen: the next open reads it as corrupt.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: ["lines": .infinity])),
            ]),
        )
        let error = try #require(throws: AtlasMapError.self) { try map.encoded() }
        guard case .unwritable = error else {
            Issue.record("an infinite measure wrote as \(error)")
            return
        }
    }
}
