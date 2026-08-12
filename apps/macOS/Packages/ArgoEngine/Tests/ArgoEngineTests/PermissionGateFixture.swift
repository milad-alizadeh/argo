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
        let client = try #require(CompanionClient(socketPath: path(fixture, claim)))
        defer { client.close() }
        try await body(fixture, claim, client)
    }

    static func path(_ fixture: SpawnFixture, _ claim: SessionOwnership.ClaimID) -> String {
        fixture.companionRoot.appending(path: "\(claim.value).gate.sock").path
    }

    /// A second hook dialling the same gate while the first is still up — what a Session with more
    /// than one call in flight looks like from this end.
    @MainActor
    static func dial(
        _ fixture: SpawnFixture,
        _ claim: SessionOwnership.ClaimID,
    ) throws
        -> CompanionClient {
        try #require(CompanionClient(socketPath: path(fixture, claim)))
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

/// The rung the gate under test reads, held apart from the fixture so the channel can be handed a
/// closure over it before the fixture itself exists.
@MainActor
final class RungHolder {
    var rung: SessionMode = .code
}

/// One gate on its own, with the rung under the test's hand rather than the roster's — the only way
/// to move a Session's rung BETWEEN two calls without a live CLI to walk it (#663).
@MainActor
final class GateFixture {
    /// The rung the next call is judged by. Moving it mid-flight is the point of this fixture.
    var rung: SessionMode {
        get { holder.rung }
        set { holder.rung = newValue }
    }

    let socketPath: String

    private let holder = RungHolder()
    private let root: URL
    private let ledger = ClaimLedger()
    private let claim = SessionOwnership.ClaimID(value: "gate-\(UUID().uuidString.prefix(8))")
    private let channel: PermissionChannel

    init() throws {
        // Short, for the reason every companion root in these suites is short: a `sockaddr_un`
        // path is 103 bytes.
        let token = String(UUID().uuidString.prefix(8))
        self.root = URL(fileURLWithPath: "/tmp/argo-g-\(token)", isDirectory: true)
        let holder = holder
        self.channel = PermissionChannel(root: root, ledger: ledger, rung: { _ in holder.rung })
        self.socketPath = try channel.grant(claim)
    }

    /// What this claim's gate has published — the same reading the roster folds into a Session.
    var facts: ClaimFacts {
        ledger.facts(for: claim)
    }

    func remove() {
        channel.withdraw(claim)
        try? FileManager.default.removeItem(at: root)
    }
}
