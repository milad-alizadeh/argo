@testable import ArgoEngine
import Foundation
import Testing

/// One gated call raised on the AGENT's side, and what the agent was finally told about it (#549).
///
/// The two CLIs raise and answer by unlike means — a hook blocking on a Unix socket, a JSON-RPC
/// request blocking on its response — which is exactly why the conformance suite reads them
/// through this rather than off the wire. Both raise the same command, so what the cockpit draws
/// can be compared as one value.
@MainActor
struct DrivenGate {
    /// The command both CLIs' gated call would run, so the Permission each raises is comparable.
    static let command = "rm -rf build"

    let raise: () throws -> Void
    /// Whether the gated call was let through, or nothing while the agent is still waiting.
    let allowed: () -> Bool?
    let close: () -> Void
}

/// The hook end of a `claude` gate: a client dialled into the socket, and the one answer it gets.
@MainActor
final class ClaudeHook {
    private var client: CompanionClient?
    /// Cached, because the socket hands its line over exactly once and the suite polls.
    private var told: JSONValue?

    init(_ fixture: SpawnFixture, _ claim: SessionOwnership.ClaimID) {
        self.client = CompanionClient(socketPath: PermissionGate.path(fixture, claim))
    }

    func raise() throws {
        try #require(client).sendLine(PermissionGate.bashCall)
    }

    func allowed() -> Bool? {
        told = told ?? client?.receive()
        return told?["hookSpecificOutput"]?
            .stringField("permissionDecision")
            .map { $0 == "allow" }
    }

    func close() {
        client?.close()
        client = nil
    }
}

/// The server end of a `codex` gate. Its request ids are its OWN — the client's requests carry a
/// method and are never read as answers, so the two id spaces cannot be confused.
@MainActor
final class CodexApprovalPeer {
    private let server: CodexConversation
    private var issued = 900

    init(server: CodexConversation) {
        self.server = server
    }

    func raise() {
        issued += 1
        server.askCommand(issued, command: DrivenGate.command)
    }

    func allowed() -> Bool? {
        server.decision(issued).map { $0 == "accept" }
    }
}
