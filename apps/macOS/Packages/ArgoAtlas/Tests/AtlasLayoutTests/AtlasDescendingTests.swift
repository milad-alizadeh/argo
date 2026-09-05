@testable import AtlasLayout
import Foundation
import Testing

/// Descending into a folder is a Map OF that folder, not a crop of the one above it (#1156). Every
/// claim here is about that: what the re-rooted Map holds, what it says about its Plots together,
/// and that going down and coming back up is the Map you started with.
@Suite("Atlas — descending into a folder")
struct AtlasDescendingTests {
    /// Two folders under one root, one of them nested a second level, and a Coupling that crosses
    /// between them — the pair that has to be dropped when the reading is one folder, because one
    /// end of it is no longer in the Map.
    private static func map() -> AtlasMap {
        AtlasMap(
            measuredAt: Date(),
            commit: "abc",
            root: AtlasPlate(path: "root", children: [
                .plot(AtlasPlot(path: "root/README.md", measures: ["lines": 4])),
                .plate(AtlasPlate(path: "root/app", children: [
                    .plot(AtlasPlot(path: "root/app/main.swift", measures: ["lines": 10])),
                    .plate(AtlasPlate(path: "root/app/ui", children: [
                        .plot(AtlasPlot(path: "root/app/ui/View.swift", measures: ["lines": 20])),
                    ])),
                ])),
                .plate(AtlasPlate(path: "root/docs", children: [
                    .plot(AtlasPlot(path: "root/docs/guide.md", measures: ["lines": 2])),
                ])),
            ]),
            relations: AtlasRelations(
                couplings: [
                    AtlasCoupling(
                        first: "root/app/main.swift",
                        second: "root/app/ui/View.swift",
                        strength: 0.5,
                    ),
                    AtlasCoupling(
                        first: "root/app/main.swift",
                        second: "root/docs/guide.md",
                        strength: 0.9,
                    ),
                ],
                inference: AtlasInference(
                    domains: [
                        AtlasDomain(name: "ui", tokens: ["ui"], members: [
                            AtlasDomainMember(path: "root/app/ui/View.swift", confidence: 0.5),
                            AtlasDomainMember(path: "root/docs/guide.md", confidence: 0.25),
                        ]),
                        AtlasDomain(name: "docs", tokens: ["docs"], members: [
                            AtlasDomainMember(path: "root/docs/guide.md", confidence: 1),
                        ]),
                    ],
                    resolution: 1.2,
                    settled: true,
                    agreement: 0.8,
                ),
            ),
        )
    }

    @Test
    func `the folder is the root, and only what stands on it is in the Map`() throws {
        let descended = try #require(Self.map().descending(to: "root/app"))
        #expect(descended.root.path == "root/app")
        #expect(descended.plots.map(\.path) == ["root/app/main.swift", "root/app/ui/View.swift"])
    }

    /// The whole subtree, not one level of it: a folder is a place, and everything under it is
    /// still in the place.
    @Test
    func `a folder's own folders come with it`() throws {
        let descended = try #require(Self.map().descending(to: "root/app"))
        #expect(descended.root.children.count == 2)
        #expect(descended.descending(to: "root/app/ui")?.plots.count == 1)
    }

    /// When it was measured and which commit it was measured at are facts about the MEASUREMENT,
    /// and descending measures nothing — so they are the ones the reader came in with. A Map that
    /// restamped them here would tell the sidebar a folder was measured just now.
    @Test
    func `the measurement is the one the reader came in with`() throws {
        let map = Self.map()
        let descended = try #require(map.descending(to: "root/app"))
        #expect(descended.measuredAt == map.measuredAt)
        #expect(descended.commit == map.commit)
    }

    /// A Coupling with one end outside the folder is not a weaker Coupling, it is a fact about two
    /// files of which the Map now holds one — so it is gone rather than halved.
    @Test
    func `what is said across the files is said about the files that are left`() throws {
        let descended = try #require(Self.map().descending(to: "root/app"))
        #expect(descended.couplings.map(\.second) == ["root/app/ui/View.swift"])
        #expect(descended.inference?.domains.map(\.name) == ["ui"])
        #expect(descended.inference?.domains.first?.paths == ["root/app/ui/View.swift"])
    }

    /// The one thing a reader can do that a Map cannot answer: nothing stands there. Nil rather
    /// than an empty Map, because an empty Map is a folder holding nothing, which is a different
    /// reading and one a caller draws rather than refuses.
    @Test
    func `a path no folder stands at is no descent`() {
        #expect(Self.map().descending(to: "root/nowhere") == nil)
        // A FILE is not a place: descending onto one would re-root the Map at a leaf.
        #expect(Self.map().descending(to: "root/README.md") == nil)
    }

    /// Descending to the root is the Map itself, not a copy of it that lost something on the way.
    /// The room reads this every time a reader clicks the plate they are already standing on.
    @Test
    func `descending to the root is the Map`() {
        let map = Self.map()
        #expect(map.descending(to: "root") == map)
    }

    /// Two levels down and two levels back is the Map you started with. This is what makes the
    /// trail a way BACK rather than a second reading: every level of it is the same Map re-rooted,
    /// so nothing is lost by going down and nothing is invented by coming up.
    @Test
    func `down and back up is the Map you started with`() throws {
        let map = Self.map()
        let down = try #require(map.descending(to: "root/app/ui"))
        #expect(down.plots.count == 1)
        #expect(map.descending(to: map.trail(to: "root/app/ui").first?.path ?? "") == map)
    }

    @Test
    func `the trail is the folders from the root down, root first`() {
        let trail = Self.map().trail(to: "root/app/ui")
        #expect(trail.map(\.path) == ["root", "root/app", "root/app/ui"])
        #expect(trail.map(\.name) == ["root", "app", "ui"])
    }

    /// Where the reader has not descended, and where they have descended to something that is no
    /// longer there — a folder of nothing but tests, hidden by the filter under them (#1161). Both
    /// are the root alone: the trail says where you ARE, and in both of those you are at the top.
    @Test
    func `no descent, and a descent nothing answers, are both the root alone`() {
        #expect(Self.map().trail(to: nil).map(\.path) == ["root"])
        #expect(Self.map().trail(to: "root/nowhere").map(\.path) == ["root"])
    }
}
