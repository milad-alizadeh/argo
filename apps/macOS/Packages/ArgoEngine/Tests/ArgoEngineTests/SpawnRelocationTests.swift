@testable import ArgoEngine
import Foundation
import Testing

/// A Session Argo spawned enters a worktree, and the CLI MOVES its transcript into that worktree's
/// own record directory. One uuid, one file, a new PATH — and a path is what the roster and the
/// ownership ledger both key a Session by, so the claim has to follow the file (#942).
@Suite("Spawn relocation")
@MainActor
struct SpawnRelocationTests {
    /// The bug in one line: entering a worktree is mandatory for every ticket build in this repo,
    /// so a claim that cannot follow the move is a claim every implementation Session loses.
    @Test
    func `a spawned Session is still Argo's own after its transcript moves`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, in: "-proj", atMs: 1000))

        await hubObserveToEnd(
            fixture.hub,
            Self.record(of: fixture, in: "-proj-worktree", atMs: 2000),
        )

        let moved = Self.url(in: "-proj-worktree").path
        #expect(fixture.hub.sessions.map(\.id) == [moved])
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        #expect(fixture.hub.ownership.ownerOf(sessionID: moved) == claim)
    }

    /// The pin on the other side: a move is only ever a move of a transcript Argo NAMED. Two paths
    /// carrying a uuid no claim asked for are still somebody else's agent, however close they ran
    /// (#742) — the fix must not widen into a lie about them.
    @Test
    func `a moved transcript Argo never named stays external`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()

        await hubObserveToEnd(fixture.hub, Self.stranger(of: fixture, in: "-proj", atMs: 1000))
        await hubObserveToEnd(
            fixture.hub,
            Self.stranger(of: fixture, in: "-proj-worktree", atMs: 2000),
        )

        let moved = Self.url(in: "-proj-worktree", uuid: "somebody-elses-agent").path
        #expect(fixture.hub.session(id: moved)?.provenance == .external)
        #expect(fixture.hub.ownership.ownerOf(sessionID: moved) == nil)
    }

    /// A uuid-named file inside a per-Project record directory, which is the shape that makes the
    /// PATH and the chain uuid two different values.
    private static func url(in project: String, uuid: String = spawnedChainID) -> URL {
        recordURL(project, uuid)
    }

    /// The record the spawned CLI wrote, under one of the two directories it lives in over its
    /// life. `atMs` is what decides which half the merged row reads — the live one is the later.
    private static func record(
        of fixture: SpawnFixture,
        in project: String,
        atMs: Int,
    )
        -> TranscriptObservation {
        hubTestObservation(at: url(in: project), events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "First prompt", images: [], atMs: atMs),
            .turnEnded(.endTurn),
        ])
    }

    private static func stranger(
        of fixture: SpawnFixture,
        in project: String,
        atMs: Int,
    )
        -> TranscriptObservation {
        hubTestObservation(at: url(in: project, uuid: "somebody-elses-agent"), events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "Not ours", images: [], atMs: atMs),
            .turnEnded(.endTurn),
        ])
    }
}
