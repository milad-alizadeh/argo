@testable import AtlasLayout
import Foundation
import Testing

/// The Map re-tiled by inferred domain (#1158).
///
/// The claims here are all about what the reshuffle must NOT do: lose a file, invent one, change
/// what one measures, or quietly file a file the inference declined to place. What the LIST beside
/// the map makes of the result is `AtlasDomainIndexTests`.
@Suite("Atlas — a domain is one region, and nothing moves but the walls")
struct AtlasRegroupingTests {
    private typealias Fixture = AtlasRegroupingFixture

    @Test func `a subject spread over two folders becomes one region`() throws {
        // The cure, and the whole ticket: `turn.swift` under `feed` and `turn.swift` under
        // `roster/rows` are one thing, and the folder tree is the only reason they were apart.
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns])).regrouped(),
        )
        let region = try #require(regrouped.root.children.first)

        #expect(region.path == "argo/@domain/turn")
        #expect(region.plots.map(\.path) == [
            "argo/feed/turn.swift", "argo/roster/rows/turn.swift",
        ])
    }

    @Test func `a file the inference placed in nothing is collected, not filed`() throws {
        // The criterion a partition is honest by: the two files no Domain claimed are visible as
        // the files no Domain claimed, rather than swept into the nearest region.
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns])).regrouped(),
        )
        let loose = try #require(regrouped.root.children.last)

        #expect(loose.path == "argo/@domain/unassigned")
        #expect(loose.plots.map(\.path) == ["argo/roster/clock.swift", "argo/README.md"])
    }

    @Test func `every file is drawn exactly once, measuring what it measured`() throws {
        // Area is conserved because nothing here touches a Measure and nothing is placed twice:
        // the tiler weighs the same Plot by the same number on either side of the switch, so a
        // file's footprint moves and does not change.
        let before = Fixture.map(inference: Fixture.inference([Fixture.turns]))
        let after = try #require(before.regrouped())

        #expect(after.plots.count == before.plots.count)
        #expect(Set(after.plots.map(\.path)) == Set(before.plots.map(\.path)))
        #expect(after.root.total(of: "lines") == before.root.total(of: "lines"))
    }

    @Test func `the regions come in the order their colours are ranked in`() throws {
        // The rank a region is coloured by is its place in the inference's own list, so the map
        // has to hold them in that list's order or the legend names the wrong region.
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns, Fixture.clocks]))
                .regrouped(),
        )

        #expect(regrouped.root.children.map(\.path) == [
            "argo/@domain/turn", "argo/@domain/clock", "argo/@domain/unassigned",
        ])
    }

    @Test func `nothing is left over when the inference placed every file`() throws {
        // No empty region: a plate holding nothing would be a folder the map draws, names and
        // lets the reader stand on, saying that nothing belongs nowhere.
        let all = AtlasDomain(name: "everything", tokens: ["everything"], members: [
            AtlasDomainMember(path: "argo/feed/turn.swift", confidence: 0.9),
            AtlasDomainMember(path: "argo/roster/rows/turn.swift", confidence: 0.9),
            AtlasDomainMember(path: "argo/roster/clock.swift", confidence: 0.9),
            AtlasDomainMember(path: "argo/README.md", confidence: 0.9),
        ])
        let regrouped = try #require(Fixture.map(inference: Fixture.inference([all])).regrouped())

        #expect(regrouped.root.children.map(\.path) == ["argo/@domain/everything"])
    }

    @Test func `two Domains the inference called one word stand at two paths`() throws {
        // A Domain is named for the word most concentrated in it, and two of them can concentrate
        // the same word. Two regions at one path is a descent that lands on whichever came first.
        //
        // The repeat is spelled with the Domain's own RANK, so the suffix is something a reader
        // can check against the rail rather than a running count that moves when an unrelated pair
        // of twins earlier in the list changes.
        let twin = AtlasDomain(name: "turn", tokens: ["turn"], members: [
            AtlasDomainMember(path: "argo/roster/clock.swift", confidence: 0.3),
        ])
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns, twin])).regrouped(),
        )

        #expect(regrouped.root.children.map(\.path) == [
            "argo/@domain/turn", "argo/@domain/turn (1)", "argo/@domain/unassigned",
        ])
    }

    @Test func `a separator in a Domain word nests no region inside another`() throws {
        // The words come from filenames, where a separator is not part of one — but a path built
        // by joining strings has to say what it does with one rather than grow a folder nothing
        // placed there.
        let slashed = AtlasDomain(name: "turn/feed", tokens: ["turn"], members: [
            AtlasDomainMember(path: "argo/feed/turn.swift", confidence: 0.8),
        ])
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([slashed])).regrouped(),
        )

        #expect(regrouped.root.children.first?.path == "argo/@domain/turn feed")
    }

    @Test func `a Map that inferred nothing cannot be re-tiled by domain`() {
        // Two readings, one answer: a Map measured before anything was inferred, and a Map whose
        // inference placed no file anywhere. Neither has a partition, and the control that asks
        // for one has to be able to say so rather than draw one grey region.
        #expect(Fixture.map(inference: nil).regrouped() == nil)
        #expect(Fixture.map(inference: Fixture.inference([], settled: false)).regrouped() == nil)
    }

    @Test func `a region keeps its colour when the Map is narrowed under it`() throws {
        // The rank is CARRIED for this: narrowing drops the Domains that lost every member, so a
        // rank counted off the surviving array would shift every Domain past the gap — and going
        // into a region, or hiding the test files, would repaint the whole map.
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns, Fixture.clocks]))
                .regrouped(),
        )
        let inside = try #require(regrouped.descending(to: "argo/@domain/clock"))

        // Alone in its own Map, and still the SECOND domain the repository was partitioned into.
        #expect(inside.inference?.domains.map(\.rank) == [1])
    }

    @Test func `the reshuffle remeasures nothing`() throws {
        // `measuredAt` and `commit` are facts about the walk that produced the Map, and moving
        // walls walks nothing — the same claim `descending(to:)` makes for the same reason.
        let before = Fixture.map(inference: Fixture.inference([Fixture.turns]))
        let after = try #require(before.regrouped())

        #expect(after.measuredAt == before.measuredAt)
        #expect(after.commit == before.commit)
        #expect(after.inference == before.inference)
    }
}
