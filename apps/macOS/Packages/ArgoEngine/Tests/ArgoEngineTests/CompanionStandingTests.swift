@testable import ArgoEngine
import Foundation
import Testing

/// The companion row's fact (#570): whether this build ships the plugin, and whether the last
/// spawn managed to write it. Liveness is deliberately absent — that is #493's.
@Suite("Companion standing")
@MainActor
struct CompanionStandingTests {
    /// The premise of every managed spawn: the package carries the plugin resources.
    @Test
    func `this build ships the plugin, so the channel reads included with spawns`() {
        let channel = CompanionChannel(root: Self.root()) { _, _ in }

        #expect(CompanionPlugin.shipsResources)
        #expect(channel.standing == .includedWithSpawns)
    }

    /// A build stripped of its resources has nothing to write, which outranks any failure: a
    /// spawn's refusal in that build is a symptom, and the row should name the cause.
    @Test
    func `a build that ships no plugin reads missing, whatever failed last`() {
        let missing = CompanionChannel.standing(ships: false, lastRefusal: "anything")

        #expect(missing == .missingFromBuild)
    }

    @Test
    func `a plugin write that failed is remembered with its reason`() {
        let channel = CompanionChannel(root: Self.root()) { _, _ in }

        #expect(throws: AgentSpawnError.self) {
            try channel.invite(Self.claim(length: 90))
        }
        guard case let .installFailed(why) = channel.standing else {
            Issue.record("expected installFailed, read \(channel.standing)")
            return
        }
        #expect(!why.isEmpty)
    }

    /// The failure is about the last spawn, not a mark against the Project: the next spawn that
    /// writes its plugin clears it.
    @Test
    func `a spawn that writes its plugin clears the remembered failure`() throws {
        let root = Self.root()
        defer { try? FileManager.default.removeItem(at: root) }
        let channel = CompanionChannel(root: root) { _, _ in }

        #expect(throws: AgentSpawnError.self) {
            try channel.invite(Self.claim(length: 90))
        }
        let claim = Self.claim(length: 4)
        _ = try channel.invite(claim)
        defer { channel.withdraw(claim) }

        #expect(channel.standing == .includedWithSpawns)
    }

    /// A root short enough that an ordinary claim's socket fits, leaving room for a long claim
    /// to blow the `sockaddr_un` limit — the one failure a test can force and undo on demand.
    private static func root() -> URL {
        URL(fileURLWithPath: "/tmp/argo-st-\(UUID().uuidString.prefix(8))", isDirectory: true)
    }

    private static func claim(length: Int) -> SessionOwnership.ClaimID {
        SessionOwnership.ClaimID(value: String(repeating: "x", count: length))
    }
}
