@testable import ArgoEngine
import Foundation
import Testing

/// A Codex Session's stance, stated in Codex's own words (#749).
///
/// The ladder is Argo's vocabulary and each CLI has its own word for the same boundary, so this is
/// the half of ADR-0025 that cannot be checked by reading `claude`'s table: a Codex Session on Code
/// reported `acceptEdits` — `claude`'s word for a boundary Codex spells with two of its own — until
/// the vocabulary was read through the Session's `cli`.
@Suite("Codex stance")
@MainActor
struct CodexStanceTests {
    /// Both halves of the boundary, in the spellings `thread/start` and `turn/start` are sent.
    @Test
    func `each rung is spelled with the approval policy and the sandbox together`() {
        #expect(CodexStance.value(for: .code) == "on-request · workspace-write")
        #expect(CodexStance.value(for: .readOnly) == "on-request · read-only")
        #expect(CodexStance.value(for: .auto) == "never · danger-full-access")
    }

    /// Read Only and Plan share a boundary here exactly as they do on the ladder, so the word says
    /// nothing about which of the two was intended.
    @Test
    func `Plan and Read Only are one word, as they are on claude`() {
        #expect(CodexStance.value(for: .plan) == CodexStance.value(for: .readOnly))
    }

    /// The one that was live and wrong: the row, not the table.
    @Test
    func `a spawned Codex Session on Code reports a Codex stance`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.openCodexSession(seed: SessionSeed(mode: .code))

        let session = try #require(fixture.hub.sessions.first)
        #expect(session.mode == .exactly(.code, cli: "on-request · workspace-write"))
    }

    /// And the `claude` reading is unchanged by the port — the two adapters state the same rung in
    /// unlike words, which is the whole reason the vocabulary is per CLI.
    @Test
    func `a spawned claude Session on the same rung reports claude's word`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        _ = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        let session = try #require(fixture.hub.sessions.first)
        #expect(session.mode == .exactly(.code, cli: "acceptEdits"))
    }
}
