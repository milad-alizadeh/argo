@testable import ArgoEngine
import Testing

/// Giving a claim up, at the three sites that do it. Until #634 the teardown was written out three
/// times and no test could name the combined behaviour: it took three separate tables to state.
///
/// Serialized for the reason the other gate suites are — these drive main-queue sources and wait on
/// the main actor for them to fire.
@Suite("Relinquishing a claim", .serialized)
@MainActor
struct HubRelinquishTests {
    @Test
    func `a PTY that exits takes every gate fact of its claim with it`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { !fixture.hub.facts(forClaim: claim).waiting.isEmpty }
            let waiting = try #require(fixture.hub.facts(forClaim: claim).waiting.first)
            try fixture.hub.driver.decide(.allowAlways, answering: waiting.id, for: claim.value)
            await settle { !fixture.hub.facts(forClaim: claim).standing.isEmpty }

            fixture.host.endLastProcess(exitCode: 0)

            // Every GATE fact goes and the rung Argo set stays, which is the test below this one.
            // `== ClaimFacts()` asked for the rung to go too, so it could never hold: unsatisfiable
            // since #663 filed the spawn's rung under the claim, and waited on every run since
            // because nothing read its answer (#918).
            await settle { fixture.hub.facts(forClaim: claim).standing.isEmpty }
            let rung = SessionModeSet(mode: .code, recordsWhenSet: 0)
            // The channel's reading stays for the reason the rung does: it is a thing that
            // happened, and the orphaned row is where it is worth saying (#493). `neverDialled`
            // because this fixture's client dials the permission gate rather than the companion
            // channel — the two are separate sockets.
            // The run Argo started the CLI at stays for the same reason as the rung: it is what
            // went on argv, and the orphaned row still states what it was started at (#1175).
            #expect(fixture.hub.facts(forClaim: claim) == ClaimFacts(
                companionLiveness: .neverDialled,
                modeSet: rung,
                run: .unpicked,
            ))
        }
    }

    /// The rung and what the agent said are not the gate's, so they survive the PTY that carried
    /// them — an orphaned Session reads as what it was rather than blanking.
    @Test
    func `a PTY that exits leaves the rung Argo set standing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        try await fixture.hub.driver.setMode(.plan, for: claim.value)

        fixture.host.endLastProcess(exitCode: 0)

        #expect(fixture.hub.facts(forClaim: claim).modeSet?.mode == .plan)
    }

    /// App quit and window close. Every claim is given up, so no socket is left open behind a
    /// Session nobody owns.
    @Test
    func `ending the owned Sessions gives up every live claim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        _ = try await fixture.hub.spawnSession()
        #expect(fixture.hub.ownership.liveClaims.count == 2)

        fixture.hub.endOwnedSessions()

        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }

    /// The live claims are the whole set the quit walks, which is what lets it be a loop over one
    /// teardown rather than a bulk call per channel: a claim with a prompt still waiting is a live
    /// claim, so the loop reaches its gate.
    @Test
    func `ending the owned Sessions closes a gate with a call still waiting`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { !fixture.hub.facts(forClaim: claim).waiting.isEmpty }

            fixture.hub.endOwnedSessions()

            // The three readings the GATE owns, and not the whole record: the rung Argo spawned
            // this Session on is something that happened, so it outlives the PTY (#663).
            let facts = fixture.hub.facts(forClaim: claim)
            #expect(facts.waiting.isEmpty)
            #expect(facts.standing.isEmpty)
            #expect(facts.expiries.isEmpty)
        }
    }

    /// A launch that failed owns nothing, so the claim it opened must not go on covering the
    /// folder — an agent somebody else starts there a moment later would read as Argo's.
    @Test
    func `a launch that fails gives its claim up again`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        fixture.host.refusal = .hostRefused(detail: "no")

        await #expect(throws: AgentSpawnError.self) {
            try await fixture.hub.spawnSession()
        }

        #expect(fixture.hub.ownership.liveClaims.isEmpty)
    }
}
