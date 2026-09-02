@testable import ArgoEngine

/// A code host that answers from a script, for the suites about deriving rather than about GitHub.
/// Each read takes the next answer and the last one repeats, so a test says "this read fails, every
/// later one succeeds" without counting ticks.
actor ScriptedCodeHost: CodeHostPort {
    private var script: [Result<[Delivery], ProviderFetchError>]
    /// What the host holds for a branch nothing in flight covers, keyed by branch. A branch with no
    /// entry is one the host holds nothing for.
    private let byBranch: [String: Delivery]

    init(_ script: [Result<[Delivery], ProviderFetchError>], byBranch: [String: Delivery] = [:]) {
        self.script = script
        self.byBranch = byBranch
    }

    func inFlight(in _: String, grant _: AccountGrant) async throws -> [Delivery] {
        guard let answer = script.count > 1 ? script.removeFirst() : script.first else { return [] }
        return try answer.get()
    }

    func delivery(
        ofBranch branch: String, in _: String, grant _: AccountGrant,
    ) async throws
        -> Delivery? {
        byBranch[branch]
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
    static func on(_ branch: String?) -> WorkspaceProjection {
        WorkspaceProjection(
            kind: .worktree,
            refs: WorkspaceProjection.Refs(branch: branch),
            drift: WorkspaceProjection.Drift(
                dirty: 0,
                divergence: UpstreamDivergence(ahead: 0, behind: 0),
            ),
        )
    }
}
