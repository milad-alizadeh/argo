@testable import ArgoEngine

/// A code host that answers from a script, for the suites about deriving rather than about GitHub.
/// Each read takes the next answer and the last one repeats, so a test says "this read fails, every
/// later one succeeds" without counting ticks.
actor ScriptedCodeHost: CodeHostPort {
    private var script: [Result<[Delivery], ProviderFetchError>]
    /// What the host holds for a branch nothing in flight covers, keyed by branch. A branch with no
    /// entry is one the host holds nothing for.
    private let byBranch: [String: Delivery]
    /// The branches this host REFUSES to answer about, told apart from the ones it holds nothing
    /// for: a refusal is the throttled read a checkout with many worktrees runs into, and "nothing
    /// there" is an answer.
    private var refusing: Set<String>
    private var reads = 0

    init(
        _ script: [Result<[Delivery], ProviderFetchError>],
        byBranch: [String: Delivery] = [:],
        refusing: Set<String> = [],
    ) {
        self.script = script
        self.byBranch = byBranch
        self.refusing = refusing
    }

    /// Start refusing these branches, which is what a host does once a read has spent the last of
    /// the hour's budget. Set after a derivation rather than at init, so a suite can land a clean
    /// one first and refuse the read after it.
    func refuse(_ branches: Set<String>) {
        refusing = branches
    }

    /// How many listings the host has answered, which is one per derivation — what a suite about
    /// the LOOP counts, rather than what any one of them landed.
    func readCount() -> Int {
        reads
    }

    func inFlight(in _: String, grant _: AccountGrant) async throws -> [Delivery] {
        reads += 1
        guard let answer = script.count > 1 ? script.removeFirst() : script.first else { return [] }
        return try answer.get()
    }

    func delivery(
        ofBranch branch: String, in _: String, grant _: AccountGrant,
    ) async throws
        -> Delivery? {
        guard !refusing.contains(branch) else { throw ProviderFetchError.rateLimited }
        return byBranch[branch]
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
