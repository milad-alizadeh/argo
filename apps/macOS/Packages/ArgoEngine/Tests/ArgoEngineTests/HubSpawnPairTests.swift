@testable import ArgoEngine
import Foundation
import Testing

/// Two fresh Sessions started back to back in ONE window (#1479).
///
/// Every other spawn suite drives a single spawn, because `SpawnFixture.TranscriptIDs.single`
/// mints one name for all of them — so the shape a person hits by starting a second Session was
/// the one shape the engine could not be asked about. `perSpawn` is what opens it.
@Suite("Hub spawn pair")
@MainActor
struct HubSpawnPairTests {
    /// Two claims, two provisional rows, and neither of them the other. Both rows read
    /// `New session` here because that is what a spawn with no record yet is CALLED — the titles
    /// come apart the moment the two CLIs write, which is the test below.
    @Test
    func `two fresh spawns publish two rows under two ids`() async throws {
        let fixture = try SpawnFixture(transcriptIDs: .perSpawn)
        defer { fixture.remove() }

        let first = try await fixture.hub.spawnSession()
        let second = try await fixture.hub.spawnSession()

        #expect(first != second)
        #expect(Set(fixture.hub.sessions.map(\.id)) == [first.value, second.value])
        #expect(fixture.hub.sessions.count == 2)
        // Both owned, both waiting on their own PTY: neither claim has taken the other's row.
        #expect(fixture.hub.sessions.allSatisfy { $0.provenance == .managed })
        #expect(fixture.hub.sessions.allSatisfy { $0.status == .starting })
        // And each was told to write a file of its own, which is what makes them two Sessions
        // rather than one name handed out twice.
        #expect(fixture.host.launches.count == 2)
    }

    /// The far end of the same spawn: each CLI has written, each claim has bound to its OWN
    /// Session, both provisional rows are gone, and the roster still holds two.
    @Test
    func `each CLI's record retires its own row and keeps the other's`() async throws {
        let fixture = try SpawnFixture(transcriptIDs: .perSpawn)
        defer { fixture.remove() }
        let first = try await fixture.hub.spawnSession()
        let second = try await fixture.hub.spawnSession()

        await hubObserveToEnd(fixture.hub, fixture.observedSpawn(
            chainID: spawnedChainID,
            prompt: "Take the roster apart",
        ))
        await hubObserveToEnd(fixture.hub, fixture.observedSpawn(
            chainID: secondSpawnedChainID,
            prompt: "Read the second ticket",
        ))

        #expect(fixture.hub.ownership.ownerOf(sessionID: spawnedChainID) == first)
        #expect(fixture.hub.ownership.ownerOf(sessionID: secondSpawnedChainID) == second)
        #expect(fixture.hub.spawns.isEmpty)
        #expect(Set(fixture.hub.sessions.map(\.id)) == [spawnedChainID, secondSpawnedChainID])
        #expect(Set(fixture.hub.sessions.map(\.title))
            == ["Take the roster apart", "Read the second ticket"])
    }

    /// One wait per row. The second child speaking says nothing about the first, which is still
    /// waiting on a descriptor of its own.
    @Test
    func `the second child's first bytes settle only the second row's wait`() async throws {
        let fixture = try SpawnFixture(transcriptIDs: .perSpawn)
        defer { fixture.remove() }
        let first = try await fixture.hub.spawnSession()
        let second = try await fixture.hub.spawnSession()
        #expect(fixture.host.started.count == 2)

        try #require(fixture.host.started.last).emit("\u{1B}[?1049h")

        #expect(fixture.hub.spawns[second]?.startup.firstOutputAtMs != nil)
        #expect(fixture.hub.spawns[first]?.startup.firstOutputAtMs == nil)
        #expect(fixture.hub.session(id: second.value)?.status == .idle)
        #expect(fixture.hub.session(id: first.value)?.status == .starting)
    }

    /// The second Session picks up a `remote_session_change` partway through its run, and every
    /// record after it carries a `session_id` naming the FIRST Session (#1479).
    @Test
    func `a second fresh Session is not chained under the first`() async throws {
        let fixture = try SpawnFixture(transcriptIDs: .perSpawn)
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let second = try await fixture.hub.spawnSession()

        try await fixture.observeFreshPair()

        #expect(fixture.hub.sessions.count == 2)
        #expect(Set(fixture.hub.sessions.map(\.title))
            == ["Take the roster apart", "Read the second ticket"])
        // The claim the shell is holding has a Session of its own, which is what takes its panel
        // out of the loading state.
        #expect(fixture.hub.ownership.ownerOf(sessionID: secondFreshURL.path) == second)
    }
}

/// The file the second of those CLIs wrote. Keyed by PATH, the way the engine keys a real record.
private let secondFreshURL = transcriptURL(ofChain: secondSpawnedChainID)

@MainActor
private extension SpawnFixture {
    /// Those two records, read through the real reader — the `session_id` this is about is a
    /// FIELD, and a hand-built event list would assert nothing about how it is read.
    func observeFreshPair() async throws {
        for (name, url) in [
            ("freshSessionFirst", spawnedTranscriptURL),
            ("freshSessionSecond", secondFreshURL),
        ] {
            try await hubObserveToEnd(hub, hubFixtureObservation(name, at: url))
        }
    }
}
