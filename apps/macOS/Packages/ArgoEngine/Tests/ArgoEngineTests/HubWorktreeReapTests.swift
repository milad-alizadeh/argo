@testable import ArgoEngine
import Foundation
import Testing

/// What archiving a Session does to the worktree it was working in (#1398).
@Suite("Hub worktree reap")
@MainActor
struct HubWorktreeReapTests {
    @Test
    func `archiving a Session in a landed worktree names it for removal`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "landed"))
        await hub.refreshWorkspaces()

        let verdict = hub.worktreeToReap(archiving: true, id: hub.sessions[0].id)

        #expect(verdict == .reap(.init(
            path: Self.worktree,
            branch: Self.branch,
            headSha: Self.headSha,
        )))
    }

    @Test
    func `putting a Session back removes nothing`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "restored"))
        await hub.refreshWorkspaces()

        let verdict = hub.worktreeToReap(archiving: false, id: hub.sessions[0].id)

        #expect(verdict == .hold(.notArchiving))
    }

    @Test
    func `a Session whose folder git has not been read for is held`() async {
        let hub = Self.hub()
        await hubObserveToEnd(hub, Self.observation(id: "unswept"))

        // No sweep has run, so nothing knows which worktree the folder is in — and an unread
        // Workspace is not a landed one.
        #expect(hub.worktreeToReap(archiving: true, id: hub.sessions[0].id) == .hold(.unread))
    }

    /// How the host files a merged pull request for the branch. `byCommit` is the state every
    /// reap is actually in: GitHub deleted the head ref as it merged, so the host holds nothing
    /// under the branch and answers only under the commit at its head (ADR-0032). Asked by branch
    /// alone that case answered `false` forever and the folder survived.
    enum Filing: Sendable {
        case byRef
        case byCommit
    }

    @Test(arguments: [Filing.byRef, .byCommit])
    func `archiving a Session whose branch merged takes its worktree with it`(
        _ filing: Filing,
    ) async {
        let asked = AskedOf()
        let hub = Self.hub(removing: { repositoryURL, candidate in
            await asked.record(repositoryURL: repositoryURL, candidate: candidate)
            return .removed
        })
        hub.codeHost = Self.merged(filedBy: filing)
        await hubObserveToEnd(hub, Self.observation(id: "merged"))
        await hub.refreshWorkspaces()

        let verdict = await hub.reapWorktree(
            archiving: true, id: hub.sessions[0].id, through: { .ready(Self.codeHost) },
        )

        #expect(verdict == .reap(.init(
            path: Self.worktree,
            branch: Self.branch,
            headSha: Self.headSha,
        )))
        #expect(await asked.branch == Self.branch)
    }

    @Test
    func `a branch the code host has not merged keeps its worktree`() async {
        let hub = Self.hub(removing: { _, _ in
            Issue.record("an unmerged branch's worktree was removed")
            return .removed
        })
        hub.codeHost = ScriptedCodeHost([], byBranch: [Self.branch: Self.open])
        await hubObserveToEnd(hub, Self.observation(id: "open"))
        await hub.refreshWorkspaces()

        let verdict = await hub.reapWorktree(
            archiving: true, id: hub.sessions[0].id, through: { .ready(Self.codeHost) },
        )

        #expect(verdict == .hold(.notLanded))
    }

    @Test
    func `a Project with no code host bound reaps nothing`() async {
        let hub = Self.hub(removing: { _, _ in
            Issue.record("a worktree was removed with no code host to confirm the merge")
            return .removed
        })
        await hubObserveToEnd(hub, Self.observation(id: "unbound"))
        await hub.refreshWorkspaces()

        // A merge nobody could confirm is not a merge.
        let verdict = await hub.reapWorktree(
            archiving: true, id: hub.sessions[0].id, through: { .unbound },
        )

        #expect(verdict == .hold(.notLanded))
    }

    @Test
    func `a reap removes the worktree from the repository the Hub is pointed at`() async {
        let asked = AskedOf()
        let hub = Self.hub(removing: { repositoryURL, candidate in
            await asked.record(repositoryURL: repositoryURL, candidate: candidate)
            return .removed
        })
        await hubObserveToEnd(hub, Self.observation(id: "removed"))
        await hub.refreshWorkspaces()

        let removal = await hub.reap(.init(
            path: Self.worktree,
            branch: Self.branch,
            headSha: Self.headSha,
        ))

        #expect(removal == .removed)
        // The checkout that HOLDS the worktree, never the folder being deleted.
        #expect(await asked.repositoryPath == Self.repository)
        #expect(await asked.branch == Self.branch)
    }

    @Test
    func `a worktree git refused to remove says why`() async {
        let hub = Self.hub(removing: { _, _ in .refused("fatal: validation failed") })

        let removal = await hub.reap(.init(
            path: Self.worktree,
            branch: Self.branch,
            headSha: Self.headSha,
        ))

        #expect(removal == .refused("fatal: validation failed"))
    }

    /// The Binding the landed question is asked through, and the two answers it can come back with.
    private static let codeHost = PortReadTarget.codeHost().binding
    private static let merged = Delivery(
        branch: branch, pullRequest: .merged(number: 1398),
    )

    /// A host holding that merged pull request under the one name the filing says it does, and
    /// under nothing else.
    private static func merged(filedBy filing: Filing) -> ScriptedCodeHost {
        switch filing {
        case .byRef: ScriptedCodeHost([], byBranch: [branch: merged])
        case .byCommit: ScriptedCodeHost([], byCommit: [headSha: merged])
        }
    }

    private static let open = Delivery(
        branch: branch, pullRequest: .stub(number: 1398),
    )

    private static let repository = reapRepository
    private static let worktree = reapWorktree
    private static let branch = reapBranch
    private static let headSha = reapHeadSha

    private static func hub(
        removing removeWorktree: @escaping WorktreeRemovalWrite = { _, _ in .removed },
    )
        -> Hub {
        Hub(
            projectURL: URL(fileURLWithPath: repository),
            engine: Engine(
                reads: .init(
                    checkout: CheckoutFixture().read,
                    worktrees: { _ in [landedWorktree] },
                    workspace: { _ in landedRead },
                    liveness: noLiveProcesses,
                ),
                writes: .init(removeWorktree: removeWorktree),
            ),
        )
    }

    private static func observation(id: String) -> TranscriptObservation {
        hubTestObservation(id: id, events: [.cwd(worktree), .title("Working", .summarised)])
    }
}
