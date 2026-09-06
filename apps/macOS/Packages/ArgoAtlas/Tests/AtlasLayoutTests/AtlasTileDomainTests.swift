@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// What a tile carries on a map tiled by domain (#1158): which Domain the file was placed in, and
/// how surely — the fact a re-rooted Map no longer says by its shape alone, because a region is a
/// Plate like any other once the tiler has it.
@Suite("Atlas — a tile says which domain it was placed in, and only when asked by domain")
struct AtlasTileDomainTests {
    private static let inference = AtlasInference(
        domains: [
            AtlasDomain(name: "turn", tokens: ["turn"], members: [
                AtlasDomainMember(path: "argo/feed/turn.swift", confidence: 0.8),
            ], rank: 0),
            AtlasDomain(name: "clock", tokens: ["clock"], members: [
                AtlasDomainMember(path: "argo/roster/clock.swift", confidence: 0.25),
            ], rank: 1),
        ],
        resolution: 1.1,
        settled: true,
        agreement: 0.9,
    )

    private static let map = AtlasMap(
        measuredAt: Date(timeIntervalSince1970: 1_756_951_037),
        commit: nil,
        root: AtlasPlate(path: "argo", children: [
            .plate(AtlasPlate(path: "argo/feed", children: [
                .plot(AtlasPlot(path: "argo/feed/turn.swift", measures: ["lines": 20])),
            ])),
            .plate(AtlasPlate(path: "argo/roster", children: [
                .plot(AtlasPlot(path: "argo/roster/clock.swift", measures: ["lines": 10])),
            ])),
            .plot(AtlasPlot(path: "argo/README.md", measures: ["lines": 5])),
        ]),
        relations: AtlasRelations(inference: inference),
    )

    private static let extent = CGSize(width: 400, height: 300)

    private static func plan(_ grouping: AtlasGrouping) throws -> AtlasPlan {
        try AtlasPlan(
            tiling: #require(grouping == .domains ? map.regrouped() : map),
            by: AtlasChannels("lines"),
            into: extent,
            grouping: grouping,
        )
    }

    private static func domain(of path: String, in plan: AtlasPlan) throws -> AtlasTileDomain? {
        try #require(plan.tiles.first { $0.path == path }).domain
    }

    @Test func `a file's rank is its Domain's place in the inference's own order`() throws {
        // The rank IS the colour: the wheel walks the golden angle by it, so a rank read off
        // anything but the inference's order paints the region the legend named something else.
        let plan = try Self.plan(.domains)

        #expect(
            try Self.domain(of: "argo/feed/turn.swift", in: plan)
                == .placed(rank: 0, confidence: 0.8),
        )
        #expect(
            try Self.domain(of: "argo/roster/clock.swift", in: plan)
                == .placed(rank: 1, confidence: 0.25),
        )
    }

    @Test func `a file the inference placed in nothing says so`() throws {
        // Not absent, which is what a file on a map tiled by FOLDER is: the two readings resolve
        // to two different colours, and absent would paint this one its measured band.
        #expect(try Self.domain(of: "argo/README.md", in: Self.plan(.domains)) == .unassigned)
    }

    @Test func `a map tiled by folder carries no domain at all`() throws {
        // The whole map, including the files the inference DID place: grouping by folder is the
        // reader asking for the measured reading, and a domain on the tile would be a second
        // claim on its colour.
        let plan = try Self.plan(.folders)

        #expect(plan.tiles.allSatisfy { $0.domain == nil })
    }

    @Test func `the same files are tiled either way, at the same total footprint`() throws {
        // Area is conserved because the tiler weighs the same Plot by the same Measure on either
        // side of the switch: the ground is one rectangle and every file is still on it.
        let folders = try Self.plan(.folders)
        let domains = try Self.plan(.domains)

        #expect(Set(folders.tiles.map(\.path)) == Set(domains.tiles.map(\.path)))
        #expect(domains.extent == folders.extent)
    }
}
