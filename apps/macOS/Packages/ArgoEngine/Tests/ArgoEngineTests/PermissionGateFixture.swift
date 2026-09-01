@testable import ArgoEngine
import Foundation
import Testing

/// A spawned Session with a client dialled into its permission gate, and the two readings every
/// suite over that gate needs: where the socket is, and what came back down it.
enum PermissionGate {
    /// One gated `Bash` call, as the hook's relay would put it.
    static let bashCall = """
    {"tool_name":"Bash","tool_input":{"command":"rm -rf build"}}
    """

    /// The patience is a parameter because one suite needs both ends of it: a day where the clock
    /// must never be what decides, and no time at all for the tests about it running out.
    ///
    /// `on` is the rung the Session opens on, and `nil` is what a New Session takes — `Code`, since
    /// this fixture's preference file is its own and empty (#629).
    @MainActor
    static func withGate(
        on mode: SessionMode? = nil,
        patience: PermissionPatience = .default,
        _ body: (SpawnFixture, SessionOwnership.ClaimID, CompanionClient) async throws -> Void,
    ) async throws {
        let fixture = try SpawnFixture(permissionPatience: patience)
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: mode))
        let client = try await CompanionClient.dialled(path(fixture, claim))
        defer { client.close() }
        try await body(fixture, claim, client)
    }

    @MainActor
    static func path(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
        of hub: Hub? = nil,
    )
        -> String {
        (hub ?? fixture.hub).companionScope.root
            .appending(path: "\(claim.value).gate.sock").path
    }

    /// A second hook dialling the same gate while the first is still up — what a Session with more
    /// than one call in flight looks like from this end.
    @MainActor
    static func dial(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    ) async throws
        -> CompanionClient {
        try await CompanionClient.dialled(path(fixture, claim))
    }

    /// The hook's decision object, unwrapped from the reply's envelope.
    @MainActor
    static func decision(read client: CompanionClient) async throws -> JSONValue {
        await Task.yield()
        var reply: JSONValue?
        await settle {
            reply = client.receive()
            return reply != nil
        }
        return try #require(reply?["hookSpecificOutput"])
    }

    /// What that decision SAID, which is all any of these tests assert on.
    @MainActor
    static func word(read client: CompanionClient) async throws -> String? {
        try await decision(read: client).stringField("permissionDecision")
    }
}
