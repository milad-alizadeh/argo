@testable import ArgoEngine
import Foundation
import Testing

/// What a standing allow does to the gate (#572), and the three things the ticket asked of one: it
/// is visible while it holds, it can be taken back without ending the Session, and the tools that
/// have no grant are asked about exactly as before.
///
/// Serialized for the reason the per-action suite is — these drive main-queue sources and wait on
/// the main actor for them to fire.
@Suite("Standing allow channel", .serialized)
@MainActor
struct StandingAllowChannelTests {
    private static let editCall = """
    {"tool_name":"Edit","tool_input":{"file_path":"a.swift"}}
    """

    @Test
    func `a standing allow is published on the Session and stops the tool asking`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            client.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }
            let waiting = try #require(fixture.hub.sessions.first?.permission)
            try fixture.hub.driver.decide(.allowAlways, answering: waiting.id, for: claim.value)

            let granted = try await PermissionGate.word(read: client)

            #expect(granted == "allow")
            // Visible without being looked for: the grant is a fact ON the Session, which is what
            // the tray in the composer's vessel is drawn from.
            #expect(fixture.hub.sessions.first?.standingAllows.map(\.toolName) == ["Bash"])

            // And the next call to that tool never becomes a prompt at all.
            let second = try PermissionGate.dial(fixture, claim)
            defer { second.close() }
            second.sendLine(PermissionGate.bashCall)

            let ungated = try await PermissionGate.word(read: second)

            #expect(ungated == "allow")
            #expect(fixture.hub.sessions.first?.permission == nil)
        }
    }

    @Test
    func `a tool with no standing allow still takes the per-action path`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            try await Self.stand(on: fixture, claim, answering: client)

            let other = try PermissionGate.dial(fixture, claim)
            defer { other.close() }
            other.sendLine(Self.editCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            #expect(fixture.hub.sessions.first?.permission?.toolName == "Edit")
        }
    }

    @Test
    func `a revoked allow leaves the Session and the tool asks again`() async throws {
        try await PermissionGate.withGate { fixture, claim, client in
            try await Self.stand(on: fixture, claim, answering: client)

            // Taken back without the Session ending, which is the whole of the second complaint
            // in #572: a standing decision with no way back is not one made carefully.
            try fixture.hub.driver.revokeStandingAllow("Bash", for: claim.value)
            #expect(fixture.hub.sessions.first?.standingAllows.isEmpty == true)

            let second = try PermissionGate.dial(fixture, claim)
            defer { second.close() }
            second.sendLine(PermissionGate.bashCall)
            await settle { fixture.hub.sessions.first?.permission != nil }

            #expect(fixture.hub.sessions.first?.permission?.toolName == "Bash")
        }
    }

    @Test
    func `revoking a grant nobody made is refused rather than passed silently`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(throws: SessionDriveError.nothingPending) {
            try fixture.hub.driver.revokeStandingAllow("Bash", for: claim.value)
        }
    }

    /// Raise one `Bash` call and answer it `allowAlways` — the only way a grant is ever made, so
    /// the tests that need one standing start by making it the way a user would.
    private static func stand(
        on fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
        answering client: CompanionClient,
    ) async throws {
        client.sendLine(PermissionGate.bashCall)
        await settle { fixture.hub.sessions.first?.permission != nil }
        let waiting = try #require(fixture.hub.sessions.first?.permission)
        try fixture.hub.driver.decide(.allowAlways, answering: waiting.id, for: claim.value)
        _ = try await PermissionGate.decision(read: client)
    }
}
