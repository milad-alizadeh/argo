@testable import ArgoEngine

extension CodeHostPort {
    /// The two port reads asked outright and unwrapped, for a suite whose subject is not the third
    /// outcome. A host with no validator on file cannot answer `unchanged`, so the unwrap is the
    /// shape of the read and not an assumption about it.
    func listed(in scope: String, grant: AccountGrant) async throws -> [Delivery] {
        try await inFlight(in: scope, grant: grant, revalidating: false).answer ?? []
    }

    func delivered(
        ofBranch branch: String, at sha: String? = nil, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery? {
        guard case let .answered(delivery) = try await delivery(
            of: BranchHead(branch: branch, sha: sha), in: scope, grant: grant,
            revalidating: false,
        ) else { return nil }
        return delivery
    }
}

extension DeliveryDerivation {
    /// One derivation over a scripted host, recording into a ledger the suite can read back. Every
    /// Delivery suite needs the pair, and none of them varies the health ledger.
    static func over(
        _ port: ScriptedCodeHost, into deliveries: DeliveryLedger,
    )
        -> DeliveryDerivation {
        DeliveryDerivation(port: port, health: ConnectionHealthLedger(), deliveries: deliveries)
    }
}

extension PortReadTarget {
    /// A code host Binding resolved onto one GitHub identity, which is every input a derivation
    /// needs.
    static func codeHost(projectID: String = "P1") -> PortReadTarget {
        let account = AccountRecord(
            provider: .github, providerAccountID: "1", displayName: "octocat",
        )
        return PortReadTarget(
            binding: ResolvedBinding(
                binding: ProjectBinding(
                    port: .codeHost, accountID: account.id, scope: "acme/api",
                ),
                account: account,
                grant: .listing,
            ),
            projectID: projectID,
        )
    }
}

extension DeliveryPullRequest {
    /// An open pull request with nothing observed on it, which is every input a derivation needs
    /// that is not the branch itself.
    static func stub(number: Int, body: String? = nil) -> DeliveryPullRequest {
        PullRequestJSON(number: number, body: body).read
    }

    /// The same, landed — a Delivery's terminal state.
    static func merged(number: Int) -> DeliveryPullRequest {
        PullRequestJSON(number: number, state: "closed", mergedAt: "2026-08-01T00:00:00Z").read
    }
}

/// A fake sleeper's own record of what happened to it: how many waits it began, and how many were
/// CANCELLED. The second one is what a case about a loop ending asserts on — a read count alone is
/// satisfied by a loop that is merely still waiting, so it would pass with `stop()` gutted.
actor PollSleeps {
    private let wait: PollWait
    private let held: Duration
    private var cancelled = 0

    init(_ wait: PollWait, held: Duration) {
        self.wait = wait
        self.held = held
    }

    /// Announce the tick, then wait — rethrowing the cancellation after recording it, because the
    /// loop reads the throw as its own exit.
    nonisolated var sleep: PortPollLoop.Sleeper {
        { _ in
            await self.wait.reach()
            try await self.hold()
        }
    }

    func cancels() -> Int {
        cancelled
    }

    private func hold() async throws {
        do {
            try await Task.sleep(for: held)
        } catch {
            cancelled += 1
            throw error
        }
    }
}

/// How many times a derivation said it had finished. Counted rather than flagged, so a test can
/// tell "raised once per read" from "raised at all".
actor DeliveryLandings {
    private var count = 0

    nonisolated var raise: DeliveryDerivation.Landing {
        { await self.record() }
    }

    func raised() -> Int {
        count
    }

    private func record() {
        count += 1
    }
}

extension WorkspaceProjection {
    /// A Workspace on one branch. `nil` is the folder git would not name a branch in, which is a
    /// detached HEAD and a Session with no Delivery.
    static func on(_ branch: String?, headSha: String? = nil) -> WorkspaceProjection {
        WorkspaceProjection(
            kind: .worktree,
            refs: WorkspaceProjection.Refs(branch: branch, headSha: headSha),
            drift: WorkspaceProjection.Drift(
                dirty: 0,
                divergence: UpstreamDivergence(ahead: 0, behind: 0),
            ),
        )
    }
}
