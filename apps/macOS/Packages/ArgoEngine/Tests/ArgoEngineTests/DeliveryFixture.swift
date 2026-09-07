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
    /// The listings answered `unchanged`, by read number from one — the host's word that what the
    /// caller holds is still current, which is neither an answer nor a refusal (#1620).
    private var unchangedListings: Set<Int>
    /// The branches answered `unchanged`, told apart from the ones the host holds nothing for:
    /// that distinction is the whole trap this fixture exists to let a suite press on.
    private var unchangedBranches: Set<String>
    private var reads = 0
    private var asked: [String] = []
    private var conditional: [String: Bool] = [:]
    private var conditionalListings: [Bool] = []

    /// Which reads this host validates rather than answers — one value, because a suite says
    /// "these are unchanged" about the tick and not about the listing and the fan-out separately.
    struct Unchanged {
        var listings: Set<Int> = []
        var branches: Set<String> = []
    }

    init(
        _ script: [Result<[Delivery], ProviderFetchError>],
        byBranch: [String: Delivery] = [:],
        refusing: Set<String> = [],
        unchanged: Unchanged = Unchanged(),
    ) {
        self.script = script
        self.byBranch = byBranch
        self.refusing = refusing
        self.unchangedListings = unchanged.listings
        self.unchangedBranches = unchanged.branches
    }

    /// Start answering `unchanged` — for these branches, and for every listing from here on. Set
    /// after a derivation rather than at init, so a suite can land a real answer first and have the
    /// tick AFTER it be the one that saved a request.
    func hold(branches: Set<String> = [], listings: Bool = false) {
        unchangedBranches = branches
        if listings {
            unchangedListings = Set(reads + 1 ... reads + 99)
        }
    }

    /// Whether each branch was asked about with a validator on it — what a suite asserts when the
    /// claim is that a read is only made conditional where its `304` can be kept.
    func askedConditionally(_ branch: String) -> Bool? {
        conditional[branch]
    }

    /// The same for the listings, in order.
    func conditionalListing() -> [Bool] {
        conditionalListings
    }

    /// Start refusing these branches, which is what a host does once a read has spent the last of
    /// the hour's budget. Set after a derivation rather than at init, so a suite can land a clean
    /// one first and refuse the read after it.
    func refuse(_ branches: Set<String>) {
        refusing = branches
    }

    /// Which branches the host was asked about BY NAME, in order — what a suite about the tick's
    /// cost counts, a branch asked about twice being the thing it asserts against.
    func branchesAsked() -> [String] {
        asked
    }

    /// How many listings the host has answered, which is one per derivation — what a suite about
    /// the LOOP counts, rather than what any one of them landed.
    func readCount() -> Int {
        reads
    }

    func inFlight(
        in _: String, grant _: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<[Delivery]> {
        reads += 1
        conditionalListings.append(revalidating)
        // Only ever to a request that carried a validator, as a host is: a fixture that answers
        // `unchanged` to an outright ask lets a suite pass on a pairing the real adapter cannot
        // produce.
        if revalidating, unchangedListings.contains(reads) {
            return .unchanged
        }
        guard let answer = script.count > 1 ? script.removeFirst() : script.first else {
            return .answered([])
        }
        return try .answered(answer.get())
    }

    func delivery(
        ofBranch branch: String, in _: String, grant _: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<Delivery?> {
        asked.append(branch)
        conditional[branch] = revalidating
        guard !refusing.contains(branch) else { throw ProviderFetchError.rateLimited }
        guard !revalidating || !unchangedBranches.contains(branch) else { return .unchanged }
        return .answered(byBranch[branch])
    }
}

extension CodeHostPort {
    /// The two port reads asked outright and unwrapped, for a suite whose subject is not the third
    /// outcome. A host with no validator on file cannot answer `unchanged`, so the unwrap is the
    /// shape of the read and not an assumption about it.
    func listed(in scope: String, grant: AccountGrant) async throws -> [Delivery] {
        try await inFlight(in: scope, grant: grant, revalidating: false).answer ?? []
    }

    func delivered(
        ofBranch branch: String, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery? {
        guard case let .answered(delivery) = try await delivery(
            ofBranch: branch, in: scope, grant: grant, revalidating: false,
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
