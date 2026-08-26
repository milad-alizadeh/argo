@testable import ArgoEngine
import Foundation
import Testing

/// `EnterWorktree` closes the transcript and opens a fresh one under the worktree's own project
/// directory. Nothing links the two on any record identifier — the only shared key is the
/// snake_case `session_id`, which names the chain's ORIGIN (#735).
///
/// Every observation here is keyed by PATH, the way `Engine.observation(at:)` keys a real record.
/// A fixture keyed by uuid cannot see a link filed under the wrong one of the two (#770).
@Suite("Worktree relocation")
struct WorktreeRelocationTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-relocation")

    /// A transcript's real shape: a uuid-named file inside a per-Project record directory.
    static func recordURL(_ project: String, _ uuid: String) -> URL {
        URL(fileURLWithPath: "/tmp/argo-records/\(project)/\(uuid).jsonl")
    }

    private static let originURL = recordURL("-tmp-argo-relocation", "worktreeOrigin")
    private static let relocatedURL = recordURL(
        "-tmp-argo-relocation--claude-worktrees-argo+735",
        "worktreeRelocated",
    )

    /// Both halves of one relocated run, read in the order they were written.
    @MainActor
    private func relocatedRun() async throws -> Hub {
        let hub = testHub(projectURL: Self.projectURL)
        let origin = try await hubFixtureObservation("worktreeOrigin", at: Self.originURL)
        let relocated = try await hubFixtureObservation("worktreeRelocated", at: Self.relocatedURL)
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
        #expect(session.id == Self.originURL.path)
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
        let session = try #require(hub.sessions.first)

        #expect(said(by: session) == ["Entering a worktree", "Working in the worktree"])
    }

    /// Opening the worktree directory on its own — the origin file is in another Project, or gone.
    @Test
    @MainActor
    func `a relocated transcript whose origin is absent is still a Session`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let relocated = try await hubFixtureObservation("worktreeRelocated", at: Self.relocatedURL)

        await hubObserveToEnd(hub, relocated)

        #expect(hub.sessions.map(\.id) == [Self.relocatedURL.path])
    }

    /// One run can enter a worktree more than once. All of its relocations name the same origin, so
    /// they are siblings on the graph rather than a linked list — every one of them still merges.
    ///
    /// Observed NEWEST first, which is the order discovery hands them over in: the merge order has
    /// to be the transcripts' own, or the row reads the worktree the run has already left.
    @MainActor
    private func twiceRelocatedRun() async -> Hub {
        let hub = testHub(projectURL: Self.projectURL)
        let origin = hubTestObservation(at: Self.recordURL("-proj", "origin"), events: [
            .originSession(id: "origin"),
            .prompt(text: "Start", images: [], atMs: 1000),
        ])
        let first = hubTestObservation(at: Self.recordURL("-proj-one", "first"), events: [
            .originSession(id: "origin"),
            .prompt(text: "First", images: [], atMs: 2000),
            .message(markdown: "First worktree"),
            .branch("worktree-one"),
        ])
        let second = hubTestObservation(at: Self.recordURL("-proj-two", "second"), events: [
            .originSession(id: "origin"),
            .prompt(text: "Second", images: [], atMs: 3000),
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

        #expect(hub.sessions.map(\.id) == [Self.recordURL("-proj", "origin").path])
    }

    @Test
    @MainActor
    func `relocated siblings merge oldest first, whatever order they arrived in`() async throws {
        let hub = await twiceRelocatedRun()

        let session = try #require(hub.sessions.first)
        #expect(said(by: session) == ["First worktree", "Second worktree"])
        #expect(session.branch == "worktree-two")
    }

    /// The fallback is a fallback: a resume names its predecessor's record, and that link is the
    /// immediate one where the origin key is only the chain's root.
    @Test
    @MainActor
    func `a resume still links on its head leaf rather than the origin`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let root = hubTestObservation(at: Self.recordURL("-proj", "root"), events: [
            .originSession(id: "root"),
            .recordIdentity(uuid: "root-tip"),
        ])
        let resumed = hubTestObservation(at: Self.recordURL("-proj", "resumed"), events: [
            .headLeaf(uuid: "root-tip"),
            .originSession(id: "root"),
            .branch("feature"),
        ])

        await hubObserveToEnd(hub, root)
        await hubObserveToEnd(hub, resumed)

        #expect(hub.sessions.map(\.id) == [Self.recordURL("-proj", "root").path])
        #expect(hub.sessions.first?.branch == "feature")
    }
}

/// Every message in a Session's feed, in order.
func said(by session: HubSession) -> [String] {
    session.events.compactMap { event -> String? in
        guard case let .message(markdown) = event else { return nil }
        return markdown
    }
}
