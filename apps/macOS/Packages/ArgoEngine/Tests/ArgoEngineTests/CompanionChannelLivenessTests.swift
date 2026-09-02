@testable import ArgoEngine
import Testing

/// The four states as the roster reads them (#493): a real socket, a real dial, and a real hang-up.
@Suite("Companion channel liveness")
@MainActor
struct CompanionChannelLivenessTests {
    @Test
    func `a spawn nothing has dialled reads never dialled`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession()

        #expect(fixture.hub.sessions.first?.companionChannel == .neverDialled)
    }

    @Test
    func `a client on the channel makes the Session read live`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        let client = try await CompanionClient.dialled(fixture.companionSocketPath(claim))
        defer { client.close() }

        try #require(await settle { fixture.hub.sessions.first?.companionChannel == .live })
    }

    /// The `dropped` rule, end to end: the client hangs up and says nothing on its way out, so what
    /// moves the reading is the socket's own hang-up rather than any silence a clock measured.
    @Test
    func `a channel whose client hung up reads dropped`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let client = try await CompanionClient.dialled(fixture.companionSocketPath(claim))
        try #require(await settle { fixture.hub.sessions.first?.companionChannel == .live })

        client.close()

        let dropped = { fixture.hub.sessions.first?.companionChannel == .dropped }
        await settle(until: dropped)
        #expect(dropped())
    }

    /// The criterion most easily got wrong: a reading taken off `managed`-ness would have this
    /// Session claiming a live channel long after the PTY that served it went.
    @Test
    func `an orphaned Session reads dropped rather than live`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let client = try await CompanionClient.dialled(fixture.companionSocketPath(claim))
        defer { client.close() }
        try #require(await settle { fixture.hub.sessions.first?.companionChannel == .live })

        fixture.host.endLastProcess(exitCode: 0)

        #expect(fixture.hub.sessions.first?.provenance == .orphaned)
        #expect(fixture.hub.sessions.first?.companionChannel == .dropped)
    }

    /// The same teardown over a channel nothing reached. Nothing was lost with it, so it does not
    /// claim a drop — `dropped` says a tier stopped arriving, and none ever did.
    @Test
    func `an orphaned Session nothing dialled keeps never dialled`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()

        fixture.host.endLastProcess(exitCode: 0)

        #expect(fixture.hub.sessions.first?.companionChannel == .neverDialled)
    }

    /// A managed Session with no channel of its own: `codex` takes no companion plugin, so there is
    /// nothing to be live or dropped. The posture says `managed` and the channel says nothing.
    @Test
    func `a managed Session whose CLI takes no plugin reads not applicable`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(cli: .codex)

        #expect(fixture.hub.sessions.first?.provenance == .managed)
        #expect(fixture.hub.sessions.first?.companionChannel == .notApplicable)
    }

    /// Every external Session's reading, which is the one an absent claim answers with: nothing was
    /// opened, so there is nothing to report on.
    @Test
    func `a claim no channel was opened for reads not applicable`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        let facts = fixture.hub.facts(forClaim: SessionOwnership.ClaimID(value: "nobody"))

        #expect(facts.companionLiveness == .notApplicable)
    }
}
