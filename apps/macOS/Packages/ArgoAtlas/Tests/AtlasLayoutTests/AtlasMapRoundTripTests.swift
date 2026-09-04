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
