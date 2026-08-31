@testable import ArgoEngine
import Foundation
import Testing

/// The companion row's fact (#570): whether this build ships the plugin and the last write worked.
@Suite("Companion standing")
@MainActor
struct CompanionStandingTests {
    @Test
    func `this build ships the plugin, so the channel reads included with spawns`() {
        let channel = CompanionChannel(scope: CompanionScope(under: Self.root())) { _, _ in }

        #expect(CompanionPlugin.shipsResources)
        #expect(channel.standing == .includedWithSpawns)
    }

    /// A build with nothing to write outranks any failure: there the failure is only a symptom.
    @Test
    func `a build that ships no plugin reads missing, whatever failed last`() {
        let missing = CompanionChannel.standing(ships: false, lastRefusal: "anything")

        #expect(missing == .missingFromBuild)
    }

    @Test
    func `a plugin write that failed is remembered with its reason`() {
        let root = Self.root()
        defer { try? FileManager.default.removeItem(at: root) }
        let channel = CompanionChannel(scope: CompanionScope(under: root)) { _, _ in }

        #expect(throws: AgentSpawnError.self) {
            try channel.invite(Self.claim(length: 90))
        }
        guard case let .installFailed(why) = channel.standing else {
            Issue.record("expected installFailed, read \(channel.standing)")
            return
        }
        #expect(!why.isEmpty)
    }

    /// The failure is about the last spawn, not a mark against the Project.
    @Test
    func `a spawn that writes its plugin clears the remembered failure`() throws {
        let root = Self.root()
        defer { try? FileManager.default.removeItem(at: root) }
        let channel = CompanionChannel(scope: CompanionScope(under: root)) { _, _ in }

        #expect(throws: AgentSpawnError.self) {
            try channel.invite(Self.claim(length: 90))
        }
        let claim = Self.claim(length: 4)
        _ = try channel.invite(claim)
        defer { channel.withdraw(claim) }

        #expect(channel.standing == .includedWithSpawns)
    }

    /// What the Hub calls when it re-points: the failure was another Project's spawn.
    @Test
    func `a re-pointed channel forgets the failure it remembered`() {
        let root = Self.root()
        defer { try? FileManager.default.removeItem(at: root) }
        let channel = CompanionChannel(scope: CompanionScope(under: root)) { _, _ in }

        #expect(throws: AgentSpawnError.self) {
            try channel.invite(Self.claim(length: 90))
        }
        channel.forgetRefusal()

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
