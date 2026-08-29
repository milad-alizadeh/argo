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
        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, at: Self.started, atMs: 1000))

        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, at: Self.moved, atMs: 2000))

        #expect(fixture.hub.sessions.map(\.id) == [Self.moved.path])
        #expect(fixture.hub.sessions.map(\.provenance) == [.managed])
        #expect(fixture.hub.ownership.ownerOf(sessionID: Self.moved.path) == claim)
    }

    /// The path the file left cannot take the claim back. It is gone from disk, so this is the
    /// stale batch rather than the ordinary case — and were it to re-bind, the ledger window on the
    /// file Argo is steering RIGHT NOW would be the one closed.
    @Test
    func `the abandoned path does not take the claim back`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, at: Self.started, atMs: 1000))
        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, at: Self.moved, atMs: 2000))

        fixture.hub.ownership.bind(sessionID: Self.started.path, uuid: spawnedChainID)

        #expect(fixture.hub.ownership.rowID(ofClaim: claim.value) == Self.moved.path)
        #expect(fixture.hub.ownership.ownerOf(sessionID: Self.moved.path) == claim)
    }

    /// The pin on the other side: a move is only ever a move of a transcript Argo NAMED. Two paths
    /// carrying a uuid no claim asked for are still somebody else's agent, however close they ran
    /// (#742) — the fix must not widen into a lie about them.
    @Test
    func `a moved transcript Argo never named stays external`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        _ = try await fixture.hub.spawnSession()
        let stranger = Self.url(in: "-proj", uuid: Self.strangerUUID)
        let strangerMoved = Self.url(in: "-proj-worktree", uuid: Self.strangerUUID)

        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, at: stranger, atMs: 1000))
        await hubObserveToEnd(fixture.hub, Self.record(of: fixture, at: strangerMoved, atMs: 2000))

        #expect(fixture.hub.session(id: strangerMoved.path)?.provenance == .external)
        #expect(fixture.hub.ownership.ownerOf(sessionID: strangerMoved.path) == nil)
    }

    /// An agent nobody here started, running in the same folders Argo's own does (#742).
    private static let strangerUUID = "somebody-elses-agent"
    /// The transcript the spawn named, where the CLI first wrote it.
    private static let started = url(in: "-proj")
    /// The same file after the Session entered a worktree.
    private static let moved = url(in: "-proj-worktree")

    /// A uuid-named file inside a per-Project record directory, which is the shape that makes the
    /// PATH and the chain uuid two different values.
    private static func url(in project: String, uuid: String = spawnedChainID) -> URL {
        recordURL(project, uuid)
    }

    /// One transcript as the tail hands it over. `atMs` is what decides which half a merged row
    /// reads — the live one is the later.
    private static func record(
        of fixture: SpawnFixture,
        at url: URL,
        atMs: Int,
    )
        -> TranscriptObservation {
        hubTestObservation(at: url, events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "First prompt", images: [], atMs: atMs),
            .turnEnded(.endTurn),
        ])
    }
}
