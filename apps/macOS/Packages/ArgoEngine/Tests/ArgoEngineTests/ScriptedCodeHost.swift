@testable import ArgoEngine

/// A code host that answers from a script, for the suites about deriving rather than about GitHub.
/// Each read takes the next answer and the last one repeats, so a test says "this read fails, every
/// later one succeeds" without counting ticks.
actor ScriptedCodeHost: CodeHostPort {
    private var script: [Result<[Delivery], ProviderFetchError>]
    /// What the host holds for a branch nothing in flight covers, keyed by branch. A branch with no
    /// entry is one the host holds nothing for.
    private let byBranch: [String: Delivery]
    /// The same, keyed by head commit — the host's answer for a branch whose ref it has deleted,
    /// which is the only way a merged Delivery is reachable at all (ADR-0032). Read second, as the
    /// adapter reads it.
    private let byCommit: [String: Delivery]
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
        byCommit: [String: Delivery] = [:],
        refusing: Set<String> = [],
        unchanged: Unchanged = Unchanged(),
    ) {
        self.script = script
        self.byBranch = byBranch
        self.byCommit = byCommit
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

    /// The adapter's own order: the branch first, then the commit where the branch answered
    /// nothing. A fixture that answered either one would let a suite pass on a lookup the real
    /// adapter cannot make.
    func delivery(
        of head: BranchHead, in _: String, grant _: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<Delivery?> {
        let branch = head.branch
        asked.append(branch)
        conditional[branch] = revalidating
        guard !refusing.contains(branch) else { throw ProviderFetchError.rateLimited }
        guard !revalidating || !unchangedBranches.contains(branch) else { return .unchanged }
        if let named = byBranch[branch] {
            return .answered(named)
        }
        guard let sha = head.sha else { return .answered(nil) }
        return .answered(byCommit[sha])
    }
}
