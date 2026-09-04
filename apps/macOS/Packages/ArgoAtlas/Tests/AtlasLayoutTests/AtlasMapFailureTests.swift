@testable import AtlasLayout
import Foundation
import Testing

/// Every way a Map file can be wrong, and the value the reader gets instead of a trap.
///
/// Written inline rather than off the fixture: the fixture is a real measurement and every case
/// here is a file no generator would produce, which is the point — the map file is app data
/// written by an earlier run and read much later, so the reader meets bytes nobody chose.
@Suite("Atlas — a Map file that cannot be read")
struct AtlasMapFailureTests {
    private func map(_ json: String) -> Data {
        Data(json.utf8)
    }

    private func wrapping(_ root: String) -> Data {
        map(#"{"version":1,"measuredAt":"2026-09-04T00:37:17Z","commit":null,"root":\#(root)}"#)
    }

    @Test func `bytes that are not a Map file read as unreadable`() throws {
        let error = try #require(throws: AtlasMapError.self) {
            try AtlasMap(decoding: map("not a map at all"))
        }
        guard case .unreadable = error else {
            Issue.record("a Map file that is not JSON read as \(error)")
            return
        }
    }

    @Test func `a Map file missing what every Map has reads as unreadable`() throws {
        let error = try #require(throws: AtlasMapError.self) {
            try AtlasMap(decoding: map(#"{"version":1,"root":{"name":"argo","children":[]}}"#))
        }
        guard case .unreadable = error else {
            Issue.record("a Map file with no measuredAt read as \(error)")
            return
        }
    }

    @Test func `a Map file from a version this reader does not know says so`() throws {
        // Told apart from corruption on purpose: "from a newer Argo" and "half a write" are the
        // same screen to the reader but not the same line in the log.
        let json = #"{"version":2,"measuredAt":"2026-09-04T00:37:17Z","#
            + #""root":{"name":"argo","children":[]}}"#
        #expect(throws: AtlasMapError.unsupportedVersion(2)) {
            try AtlasMap(decoding: map(json))
        }
    }

    @Test func `a node with no name is refused rather than given the empty path`() throws {
        let json = #"{"name":"argo","children":[{"kind":"plot","name":"","measures":{}}]}"#
        #expect(throws: AtlasMapError.unnamedNode(inside: "argo")) {
            try AtlasMap(decoding: wrapping(json))
        }
    }

    @Test func `a name holding the separator is refused, because it is two paths`() throws {
        let json = #"{"name":"argo","children":[{"kind":"plot","name":"a/b.swift","measures":{}}]}"#
        #expect(throws: AtlasMapError.unnamedNode(inside: "argo")) {
            try AtlasMap(decoding: wrapping(json))
        }
    }

    @Test func `two nodes on one Plate with one name are refused`() throws {
        // One path would name two files, and everything downstream keys off the path: the search
        // would find one, the pick would find the other, and nothing could say which was drawn.
        let json = """
        {"name":"argo","children":[
          {"kind":"plot","name":"Same.swift","measures":{"lines":3}},
          {"kind":"plot","name":"Same.swift","measures":{"lines":4}}]}
        """
        #expect(throws: AtlasMapError.repeatedName("argo/Same.swift")) {
            try AtlasMap(decoding: wrapping(json))
        }
    }

    @Test func `a Plot that measured nothing is a Plot, not a failure`() throws {
        // A generator that could measure nothing about a file still found the file, and a map
        // that dropped it would be a map of a repository missing a file nobody deleted.
        let json = #"{"name":"argo","children":[{"kind":"plot","name":"opaque.bin"}]}"#
        let decoded = try AtlasMap(decoding: wrapping(json))
        #expect(decoded.plots.map(\.path) == ["argo/opaque.bin"])
        #expect(decoded.plots[0].measures.isEmpty)
        #expect(decoded.measureNames.isEmpty)
    }
}
