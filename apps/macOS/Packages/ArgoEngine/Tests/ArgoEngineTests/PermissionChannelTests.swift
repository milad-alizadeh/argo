@testable import ArgoEngine
import Testing

/// A gated call over a real hook: it blocks the agent and raises a Permission in the roster, and
/// the user's answer goes back down the same socket the hook asked on.
///
/// Every case here drives a live relay. What the spawn INSTALLS before any of that, and what the
/// driver refuses with nothing waiting, are `PermissionGateWiringTests` — neither needs a socket.
///
/// Serialized because every test here drives a `DispatchSource` on the MAIN queue and waits on the
/// main actor for it to fire; in parallel they are a dozen waits sharing one runloop, and a wait
/// that starves its own event handler fails as "the agent never asked".
@Suite("Permission channel", .serialized)
@MainActor
struct PermissionChannelTests {
    @Test
    func `a gated call raises a Permission and the Session reads it DIRECT`() async throws {
        try await PermissionGate.withGate { fixture, _, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            let session = try #require(fixture.hub.sessions.first)
            let request = try #require(session.permission)
            #expect(request.toolName == "Bash")
            #expect(request.target == .command("rm -rf build"))
            #expect(session.statusReading == SessionStatusReading(
                tier: .direct,
                status: .permission,
            ))
        }
    }

    /// The top rung asks nothing, Argo's own gate included (ADR-0025, #663).
    @Test
    func `a call on Auto is allowed without anyone being asked`() async throws {
        try await PermissionGate.withGate(on: .auto) { fixture, _, client in
            client.sendLine(PermissionGate.bashCall)

            let answer = try await PermissionGate.word(read: client)

            let session = try #require(fixture.hub.sessions.first)
            #expect(answer == "allow")
            #expect(session.permission == nil)
        }
    }

    /// The rung below the top still has an edge, so the gate goes on asking there (#663).
    @Test
    func `a call on Read Only still asks`() async throws {
        try await PermissionGate.withGate(on: .readOnly) { fixture, _, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            #expect(fixture.hub.sessions.first?.permission != nil)
        }
    }

    /// The rung is read per call, which is what makes a walk (#653) reach the gate.
    @Test
    func `a rung the Session walks to is the one the next call is judged by`() async throws {
        let gate = try GateFixture()
        defer { gate.remove() }
        let asking = try await CompanionClient.dialled(gate.socketPath)
        defer { asking.close() }

        asking.sendLine(PermissionGate.bashCall)
        await settle { !gate.facts.waiting.isEmpty }
        #expect(!gate.facts.waiting.isEmpty)

        gate.rung = .auto
        let allowed = try await CompanionClient.dialled(gate.socketPath)
        defer { allowed.close() }
        allowed.sendLine(PermissionGate.bashCall)

        #expect(try await PermissionGate.word(read: allowed) == "allow")
        // The call that was already waiting stays waiting: the rung says what happens NEXT, and
        // a prompt somebody is looking at is not something a later change may answer for them.
        #expect(gate.facts.waiting.count == 1)
    }

    @Test
    func `an allow goes back down the hook and clears the prompt`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)

            let answer = try await PermissionGate.word(read: client)

            #expect(answer == "allow")
            #expect(fixture.hub.sessions.first?.permission == nil)
            #expect(fixture.hub.sessions.first?.status != .permission)
        }
    }

    @Test
    func `a deny goes back down the hook as a denial`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.deny, answering: waiting.id, for: claim.value)

            let answer = try await PermissionGate.word(read: client)

            #expect(answer == "deny")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `answering one call does not answer the next one for the same tool`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)
            _ = try await PermissionGate.decision(read: client)

            // A plain allow is spent on the call it was given for; the standing answer is
            // `allowAlways` (#572).
            let second = try await PermissionGate.dial(fixture, claim)
            defer { second.close() }
            second.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            #expect(fixture.hub.sessions.first?.permission != nil)
            #expect(fixture.hub.sessions.first?.standingAllows.isEmpty == true)
        }
    }

    @Test
    func `a hook that goes unanswered takes its prompt with it`() async throws {
        try await PermissionGate.withGate { fixture, _, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            client.close()
            await settle { fixture.hub.sessions.first?.permission == nil }

            #expect(fixture.hub.sessions.first?.permission == nil)
            #expect(fixture.hub.sessions.first?.status != .permission)
        }
    }

    @Test
    func `a request the gate cannot read is denied, never left to freeze the turn`() async throws {
        try await PermissionGate.withGate { fixture, _, client in
            client.sendLine("not json")

            let answer = try await PermissionGate.word(read: client)

            #expect(answer == "deny")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `an answer to a Permission that is no longer waiting reaches no other one`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let displayed = try #require(fixture.hub.sessions.first?.permission)

            // A second call arrives behind the first, then the first's hook goes with its own
            // turn — the window in which a positional answer would spend Allow on the newcomer.
            let second = try await PermissionGate.dial(fixture, claim)
            defer { second.close() }
            second.sendLine(PermissionGate.bashCall)
            client.close()
            await settle {
                fixture.hub.sessions.first?.permission.map { $0.id != displayed.id } ?? false
            }

            #expect(throws: SessionDriveError.nothingPending) {
                try fixture.hub.driver.decide(.allow, answering: displayed.id, for: claim.value)
            }
            #expect(fixture.hub.sessions.first?.permission != nil)
        }
    }
}
