@testable import ArgoEngine
import Foundation
import Testing

/// A live companion channel for a suite to talk down: a spawned Session, its socket, and a client
/// dialled into it.
///
/// Its own type rather than four `private static` helpers on one suite, so a second suite about a
/// second tool of the same channel talks to the same server the first one does — two harnesses
/// would be two servers to keep in step (#1203).
@MainActor
enum CompanionChannelHarness {
    /// A spawned Session with a client on its channel, torn down after. A closure because `defer`
    /// cannot be lifted into a helper that returns.
    static func withChannel(
        _ body: (SpawnFixture, CompanionClient) async throws -> Void,
    ) async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        let client = try await CompanionClient.dialled(socketPath(fixture, claim))
        defer { client.close() }
        try await body(fixture, client)
    }

    /// One tool call, answered — the shape every report takes.
    static func report(
        _ client: CompanionClient,
        _ name: String,
        _ arguments: [String: Any],
    ) async throws {
        client.send(CompanionClient.toolCall(id: 1, name: name, arguments: arguments))
        _ = try await reply(to: client)
    }

    static func socketPath(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    )
        -> String {
        fixture.companionSocketPath(claim)
    }

    /// Let the server's run loop turn, then read its answer. The socket is served on the main
    /// actor, so a test that read without yielding would read before anything was written.
    static func reply(to client: CompanionClient) async throws -> JSONValue {
        await Task.yield()
        var reply: JSONValue?
        await settle {
            reply = client.receive()
            return reply != nil
        }
        return try #require(reply)
    }
}
