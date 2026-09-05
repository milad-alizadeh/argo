import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// The inferred half of a Map file, written and read again (#1157).
///
/// Its own suite rather than more of `AtlasMapRoundTripTests`, because the claims are a
/// different kind: a Domain is written as POSITIONS in the Plot order, and every one of these is
/// about what those positions mean on the way back in.
@Suite("Atlas — the Domains survive being written and read again")
struct AtlasMapInferenceTests {
    @Test func `the Domains come back holding the same files`() throws {
        // Members are written as positions in the Plot order and read back as paths, so this is
        // the one claim that a Domain drawn on the map holds the files the inference placed.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 1_756_951_037),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
                .plate(AtlasPlate(path: "argo/rules", children: [
                    .plot(AtlasPlot(path: "argo/rules/house.md", measures: [:])),
                ])),
            ]),
            relations: AtlasRelations(inference: AtlasInference(
                domains: [AtlasDomain(name: "house", tokens: ["house", "rules"], members: [
                    AtlasDomainMember(path: "argo/rules/house.md", confidence: 0.5),
                ])],
                resolution: 1.2,
                settled: true,
                agreement: 0.734,
            )),
        )
        #expect(try AtlasMap(decoding: map.encoded()) == map)
    }

    @Test func `an inference that settled on nothing comes back saying so`() throws {
        // The case the reader must not paper over: no plateau is a real answer, and it survives
        // the file rather than being lost to a default of true.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
            ]),
            relations: AtlasRelations(inference: AtlasInference(
                domains: [], resolution: 0.4, settled: false, agreement: nil,
            )),
        )
        let read = try #require(try AtlasMap(decoding: map.encoded()).inference)

        #expect(!read.settled)
        #expect(read.agreement == nil)
        #expect(read.domains.isEmpty)
    }

    @Test func `a Map file written before anything was inferred infers nothing`() throws {
        // Absent from every Map file this repository wrote before #1157. Those are valid
        // measurements, and a reader that refused them would fail on app data it wrote itself.
        let json = #"{"version":1,"measuredAt":"2026-09-04T00:37:17Z","commit":null,"#
            + #""root":{"name":"argo","children":[]}}"#
        #expect(try AtlasMap(decoding: Data(json.utf8)).inference == nil)
    }

    @Test func `a Domain naming a file the Map does not hold is refused`() throws {
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
            ]),
            relations: AtlasRelations(inference: AtlasInference(
                domains: [AtlasDomain(name: "gone", tokens: [], members: [
                    AtlasDomainMember(path: "argo/b.swift", confidence: 1),
                ])],
                resolution: 1, settled: true, agreement: nil,
            )),
        )
        #expect(throws: AtlasMapError.domainOutsideMap("argo/b.swift")) { try map.encoded() }
    }

    @Test func `a Domain holding no files at all is refused rather than written`() throws {
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
            ]),
            relations: AtlasRelations(inference: AtlasInference(
                domains: [AtlasDomain(name: "nobody", tokens: [], members: [])],
                resolution: 1, settled: true, agreement: nil,
            )),
        )
        #expect(throws: AtlasMapError.emptyDomain("nobody")) { try map.encoded() }
    }

    @Test func `the Plots no Domain took are the Map's unassigned files`() {
        // A file is allowed to belong to nothing, and what belongs to nothing is derived from
        // what belongs to something rather than written twice.
        let map = AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plot(AtlasPlot(path: "argo/a.swift", measures: [:])),
                .plot(AtlasPlot(path: "argo/b.swift", measures: [:])),
            ]),
            relations: AtlasRelations(inference: AtlasInference(
                domains: [AtlasDomain(name: "first", tokens: [], members: [
                    AtlasDomainMember(path: "argo/a.swift", confidence: 1),
                ])],
                resolution: 1, settled: true, agreement: nil,
            )),
        )
        #expect(map.unassigned.map(\.path) == ["argo/b.swift"])
    }
}
