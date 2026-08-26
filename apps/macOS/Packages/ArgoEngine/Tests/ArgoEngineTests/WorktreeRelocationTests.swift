@testable import ArgoEngine
import Foundation
import Testing

/// `EnterWorktree` closes the transcript and opens a fresh one under the worktree's own project
/// directory. Nothing links the two on any record identifier — the only shared key is the
/// snake_case `session_id`, which names the chain's ORIGIN (#735).
@Suite("Worktree relocation")
struct WorktreeRelocationTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-relocation")

    /// Both halves of one relocated run, read in the order they were written.
    @MainActor
    private func relocatedRun() async throws -> Hub {
        let hub = testHub(projectURL: Self.projectURL)
        let origin = try await hubFixtureObservation("worktreeOrigin")
        let relocated = try await hubFixtureObservation("worktreeRelocated")
        await hubObserveToEnd(hub, origin)
        await hubObserveToEnd(hub, relocated)
        return hub
    }

    /// The one reading no roster assertion can make: that the key is taken off the record at all.
    /// `session_id` sits beside the top-level `sessionId` that names the file itself, and reading
    /// the wrong one of the two would link nothing while looking correct.
    @Test
    func `a relocated transcript names the origin session it continues`() async throws {
        let relocated = try await Fixture.events("worktreeRelocated")

        #expect(relocated.contains(.originSession(id: "worktreeOrigin")))
    }

    @Test
    @MainActor
    func `a worktree relocation leaves one roster row`() async throws {
        let hub = try await relocatedRun()

        let session = try #require(hub.sessions.first)
        #expect(hub.sessions.count == 1)
        #expect(session.id == "worktreeOrigin")
        #expect(session.title == "Build the relocation link")
    }

    /// The relocated half is the live one, so the row reads the worktree rather than the checkout
    /// the run started in.
    @Test
    @MainActor
    func `the merged row reads the worktree, not the origin checkout`() async throws {
        let hub = try await relocatedRun()

        let session = try #require(hub.sessions.first)
        #expect(session.cwd == "/Users/x/proj/.claude/worktrees/argo+735")
        #expect(session.branch == "worktree-argo+735")
    }

    /// Both halves' prose, in the order the two files were written — one continuous feed.
    @Test
    @MainActor
    func `the merged row's feed is continuous across the relocation`() async throws {
        let hub = try await relocatedRun()

        let said = try #require(hub.sessions.first).events.compactMap { event -> String? in
            guard case let .message(markdown) = event else { return nil }
            return markdown
        }
        #expect(said == ["Entering a worktree", "Working in the worktree"])
    }

    /// Opening the worktree directory on its own — the origin file is in another Project, or gone.
    @Test
    @MainActor
    func `a relocated transcript whose origin is absent is still a Session`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let relocated = try await hubFixtureObservation("worktreeRelocated")

        await hubObserveToEnd(hub, relocated)

        #expect(hub.sessions.map(\.id) == ["worktreeRelocated"])
    }

    /// One run can enter a worktree more than once. All of its relocations name the same origin, so
    /// they are siblings on the graph rather than a linked list — every one of them still merges.
    ///
    /// Observed NEWEST first, which is the order discovery hands them over in: the merge order has
    /// to be the transcripts' own, or the row reads the worktree the run has already left.
    @MainActor
    private func twiceRelocatedRun() async -> Hub {
        let hub = testHub(projectURL: Self.projectURL)
        let origin = hubTestObservation(id: "origin", events: [
            .originSession(id: "origin"),
            .prompt(text: "Start", atMs: 1000),
        ])
        let first = hubTestObservation(id: "first", events: [
            .originSession(id: "origin"),
            .prompt(text: "First", atMs: 2000),
            .message(markdown: "First worktree"),
            .branch("worktree-one"),
        ])
        let second = hubTestObservation(id: "second", events: [
            .originSession(id: "origin"),
            .prompt(text: "Second", atMs: 3000),
            .message(markdown: "Second worktree"),
            .branch("worktree-two"),
        ])

        await hubObserveToEnd(hub, second)
        await hubObserveToEnd(hub, first)
        await hubObserveToEnd(hub, origin)
        return hub
    }

    @Test
    @MainActor
    func `several relocations off one origin merge into one row`() async {
        let hub = await twiceRelocatedRun()

        #expect(hub.sessions.map(\.id) == ["origin"])
    }

    @Test
    @MainActor
    func `relocated siblings merge oldest first, whatever order they arrived in`() async throws {
        let hub = await twiceRelocatedRun()

        let session = try #require(hub.sessions.first)
        let said = session.events.compactMap { event -> String? in
            guard case let .message(markdown) = event else { return nil }
            return markdown
        }
        #expect(said == ["First worktree", "Second worktree"])
        #expect(session.branch == "worktree-two")
    }

    /// The fallback is a fallback: a resume names its predecessor's record, and that link is the
    /// immediate one where the origin key is only the chain's root.
    @Test
    @MainActor
    func `a resume still links on its head leaf rather than the origin`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let root = hubTestObservation(id: "root", events: [
            .originSession(id: "root"),
            .recordIdentity(uuid: "root-tip"),
        ])
        let resumed = hubTestObservation(id: "resumed", events: [
            .headLeaf(uuid: "root-tip"),
            .originSession(id: "root"),
            .branch("feature"),
        ])

        await hubObserveToEnd(hub, root)
        await hubObserveToEnd(hub, resumed)

        #expect(hub.sessions.map(\.id) == ["root"])
        #expect(hub.sessions.first?.branch == "feature")
    }
}
