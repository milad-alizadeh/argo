@testable import AtlasLayout
import Foundation
import Testing

/// The list of subjects beside a map tiled by them (#1158).
///
/// Its own suite rather than more of `AtlasRegroupingTests`, because the claims are a different
/// kind: those are about what the reshuffle does to a repository, and these are about what a rail
/// may say about the result — which regions it names, which it must not, and the one reading it
/// must refuse outright.
@Suite("Atlas — the list of subjects says what the map is really tiled by")
struct AtlasDomainIndexTests {
    private typealias Fixture = AtlasRegroupingFixture

    @Test func `the list indexes the regions, not the files in none`() throws {
        // The list is a list of SUBJECTS. The files belonging to nothing are on the map, where a
        // reader can see how much of the repository they are — a row for them would be the list
        // claiming the inference made one more guess than it did.
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns])).regrouped(),
        )
        let regions = regrouped.domainIndex(matching: "")

        #expect(regions.map(\.name) == ["turn"])
        #expect(regions.first?.count == 2)
        #expect(regions.first?.path == "argo/@domain/turn")
    }

    @Test func `a region is matched to its Domain by position, never by name`() throws {
        // Two Domains named for one word stand at two paths, and the second must take the second
        // rank — its colour. Matched by name they would fold into one, and the map would paint a
        // region the colour the legend gave another.
        let twin = AtlasDomain(name: "turn", tokens: ["turn"], members: [
            AtlasDomainMember(path: "argo/roster/clock.swift", confidence: 0.3),
        ])
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns, twin])).regrouped(),
        )
        let regions = regrouped.domainIndex(matching: "")

        #expect(regions.map(\.rank) == [0, 1])
        #expect(regions.map(\.name) == ["turn", "turn (1)"])
    }

    @Test func `a question narrows the regions by what they are called`() throws {
        // The find field asks for a file, a folder OR a domain, and a subject is answered by its
        // name — the path is the repository's own root with that name hung off it, so matching on
        // it would let the repository's name answer every term.
        let regrouped = try #require(
            Fixture.map(inference: Fixture.inference([Fixture.turns, Fixture.clocks]))
                .regrouped(),
        )

        #expect(regrouped.domainIndex(matching: "clo").map(\.name) == ["clock"])
        #expect(regrouped.domainIndex(matching: "argo").isEmpty)
    }

    @Test func `a Map tiled by folder indexes no regions at all`() {
        // The rail follows the map: a list of subjects beside a map tiled by path is answering a
        // question nobody asked.
        let map = Fixture.map(inference: Fixture.inference([Fixture.turns]))

        #expect(map.domainIndex(matching: "").isEmpty)
    }

    @Test func `a folder named for a Domain is not read as that Domain's region`() {
        // The namespace is what makes the reading above safe rather than lucky. A Domain is named
        // for the token most concentrated in its files, which very often IS a top-level folder
        // name — and this Map's first folder is called exactly what its first Domain is.
        let named = AtlasDomain(name: "feed", tokens: ["feed"], members: [
            AtlasDomainMember(path: "argo/feed/turn.swift", confidence: 0.8),
        ])
        let map = Fixture.map(inference: Fixture.inference([named]))

        #expect(map.regions.isEmpty)
        #expect(map.domainIndex(matching: "").isEmpty)
    }

    @Test func `a region's swatch is washed out by how surely its files hold it`() {
        // The Domain's own confidence is the MEAN of its members' margins, derived rather than
        // stored — so the swatch in the list and the roofs in the region cannot drift apart.
        #expect(Fixture.turns.confidence == (0.8 + 0.6) / 2)
    }
}
