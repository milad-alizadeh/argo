import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// The list beside the map (#1155). The claim under test is that it is read off the SAME Map by
/// the same rule the map is drawn from — so what the list says is in the repository is what the
/// picture beside it stands on.
@Suite("Atlas — the index beside the map")
struct AtlasIndexEntryTests {
    private static let channels = AtlasChannels(
        footprint: "lines", band: "commits", height: "commits",
    )

    private static func map() -> AtlasMap {
        AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 0),
            commit: nil,
            root: AtlasPlate(path: "root", children: [
                .plate(AtlasPlate(path: "root/Sources", children: [
                    .plot(AtlasPlot(
                        path: "root/Sources/Engine.swift",
                        measures: ["lines": 420, "commits": 47],
                    )),
                ])),
                .plot(AtlasPlot(path: "root/logo.png", measures: ["lines": 0])),
            ]),
        )
    }

    @Test
    func `a row holds the name and the folder apart`() throws {
        let entry = try #require(Self.map().index(matching: "", by: Self.channels).first)
        #expect(entry.path == "root/Sources/Engine.swift")
        #expect(entry.name == "Engine.swift")
        #expect(entry.folder == "root/Sources")
    }

    @Test
    func `a file at the root of the measurement has no folder to name`() throws {
        let index = Self.map().index(matching: "logo", by: Self.channels)
        let entry = try #require(index.first)
        #expect(index.count == 1)
        #expect(entry.name == "logo.png")
        #expect(entry.folder == "root")
    }

    @Test
    func `a row is worth what it measures on the channel the map is coloured by`() throws {
        let entry = try #require(Self.map().index(matching: "engine", by: Self.channels).first)
        #expect(entry.value == 47)
    }

    /// The ticket's last criterion, one rung down: a file the measurement carries no such number
    /// for says nothing rather than zero, and only an absent value can be drawn as an absence.
    @Test
    func `a file with no such measure carries none, not zero`() throws {
        let entry = try #require(Self.map().index(matching: "logo", by: Self.channels).first)
        #expect(entry.value == nil)
    }

    /// The list and the map cannot disagree, because they are one Map: every path the index names
    /// is a Plot of the Map the picture is tiled from.
    @Test
    func `every row names a file the map itself holds`() throws {
        let map = try AtlasMapFixture.argo()
        let paths = Set(map.plots.map(\.path))
        let index = map.index(matching: "swift", by: AtlasChannels.opening(for: map))
        #expect(!index.isEmpty)
        #expect(index.allSatisfy { paths.contains($0.path) })
    }
}
