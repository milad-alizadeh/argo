import Foundation

/// The code host port filled by GitHub pull requests, read through one Binding's grant.
///
/// Every word this hands on is GitHub's own: the pull request's state, each Check's name and each
/// review's verdict cross this boundary unrenamed (`CONTEXT.md` L4).
public struct GitHubDeliveries: CodeHostPort {
    let reads: GitHubReads

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.reads = GitHubReads(transport: transport)
    }

    public func inFlight(
        in scope: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<[Delivery]> {
        try await deliveries(
            listedBy: "/repos/\(scope)/pulls?state=open", in: scope, grant: grant,
            revalidating: revalidating,
        )
    }

    /// `head` takes an `owner:branch`, and the owner is the half of the Binding's scope before the
    /// slash. Most-recently-updated first, so the branch's current life is the first answer.
    ///
    /// The branch is percent-encoded on its way into the query, and this is not a formality: every
    /// branch Argo's own worktrees are cut on carries a `#`, which a URL reads as the start of a
    /// fragment — so the unencoded spelling asks the host about every pull request in the
    /// repository and answers with whichever was touched last (#1398).
    ///
    /// The ref filter matches the pull request's LIVE head ref, which GitHub deletes on merge, so
    /// it answers for 26 of this checkout's 81 local branches; the head commit is asked where it
    /// answers nothing, and the two composed reach 66 (ADR-0032).
    public func delivery(
        of head: BranchHead, in scope: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<Delivery?> {
        let owner = scope.prefix { $0 != "/" }
        let named = head.branch
            .addingPercentEncoding(withAllowedCharacters: .branchInAQuery) ?? head.branch
        let byRef = try await deliveries(
            listedBy: "/repos/\(scope)/pulls?state=all&sort=updated&direction=desc"
                + "&head=\(owner):\(named)",
            in: scope,
            grant: grant,
            revalidating: revalidating,
            only: 1,
        ).map(\.first)
        // `unchanged` is the host's word about the REF listing only, and it is passed on rather
        // than followed by the commit query: the caller holds this branch's last answer and the
        // saving #1620 bought is exactly this request. What that costs is narrow and real — a
        // pull request opened, merged and ref-deleted between two asks of one branch is unseen
        // until the window restarts, because an empty listing's validator does not move.
        guard let answered = byRef.answer else { return .unchanged }
        if let found = answered {
            return .answered(found)
        }
        guard let sha = head.sha else { return .answered(nil) }
        let byCommit = try await delivery(atCommit: sha, in: scope, grant: grant)
        return .answered(byCommit?.keyed(to: head.branch))
    }

    /// The same question keyed on a commit rather than on a ref, for the branch the host has
    /// deleted (ADR-0032). Asked only where the ref filter answered nothing, so a live branch pays
    /// for none of this. A 422 reads as `nil` and does not refuse the read.
    ///
    /// One page, unwalked: after the filter below the set is the pull requests whose HEAD is this
    /// one commit, and thirty of those on a single commit is not a state git can produce.
    private func delivery(
        atCommit sha: String, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery? {
        let pulls: [GitHubPullRequest]? = try await reads.found(
            "/repos/\(scope)/commits/\(sha)/pulls", grant: grant, tolerating: \.isCommitAbsent,
        )
        guard let chosen = Self.headed(by: sha, of: pulls ?? []) else { return nil }
        return try await delivery(chosen, in: scope, grant: grant)
    }

    /// The pull request this commit is the HEAD of, and never merely one this commit belongs to.
    ///
    /// The filter is the whole safety of the fallback. GitHub documents this endpoint as listing
    /// "the merged pull request that introduced the commit to the repository", so a branch sitting
    /// at the base's tip — every freshly cut worktree — is answered with whichever pull request
    /// produced that tip. Taken as the branch's own, that reads a never-pushed worktree as landed
    /// and `Hub.hasLanded` reaps it, and it files the Delivery under the OTHER branch's ref. A
    /// squash-merged branch still passes: the local tip is the pull request's head commit, and the
    /// merge commit on the base is a different one.
    ///
    /// Ranked merged-first, then by the host's own `updated_at`, then by number so no two orderings
    /// of the same page answer differently. The endpoint takes no `sort`, so this order is Argo's.
    /// The timestamps are ISO-8601 in UTC at a fixed width, which sorts as text.
    private static func headed(
        by sha: String, of pulls: [GitHubPullRequest],
    )
        -> GitHubPullRequest? {
        let own = pulls.filter { $0.head.sha == sha }
        let ranked = own.sorted {
            ($0.updatedAt ?? "", $0.number) > ($1.updatedAt ?? "", $1.number)
        }
        return ranked.first { $0.mergedAt != nil } ?? ranked.first
    }

    /// The listing, and one assembled Delivery per pull request in it — or, capped at `only`, per
    /// the first that many.
    ///
    /// `only` is what `delivery(ofBranch:)` passes 1 to: sorted most-recently-updated first,
    /// `head=` can still answer more than one pull request where a branch name was reused, and
    /// every one past the first is thrown away by the `.first` that caller takes. Assembling them
    /// anyway paid two requests apiece — the checks and the reviews — for a Delivery nothing ever
    /// reads (#1571). `inFlight` passes `nil`: every pull request its own listing returns is
    /// already open, and every one of them is what "in flight" means.
    ///
    /// Only the LISTING is conditional. The check runs and the reviews below are asked outright
    /// every time, because a `304` on the listing is silent about them: a check run finishing does
    /// not touch the pull request it ran on, so the listing's body — and its ETag with it — stands
    /// still while CI moves. Answering the whole Delivery `unchanged` off the listing alone would
    /// freeze the one thing on an open pull request a person is watching. What a caller may opt
    /// into with `revalidating` is therefore narrow by construction: it holds nothing for this read
    /// whose parts can move on their own (#1620).
    private func deliveries(
        listedBy path: String,
        in scope: String,
        grant: AccountGrant,
        revalidating: Bool,
        only limit: Int? = nil,
    ) async throws
        -> PortReading<[Delivery]> {
        let listed = try await reads.pages(
            [GitHubPullRequest].self, of: path, grant: grant, revalidating: revalidating,
        )
        guard let pulls = listed.answer else { return .unchanged }
        let bounded = limit.map { Array(pulls.prefix($0)) } ?? pulls
        var deliveries: [Delivery] = []
        for pull in bounded {
            try await deliveries.append(delivery(pull, in: scope, grant: grant))
        }
        return .answered(deliveries)
    }

    /// One pull request with what was observed on it — which is TWO more requests, one for the
    /// check runs and one for the reviews.
    ///
    /// Neither is asked for once the host says this pull request's life is over: a merged or closed
    /// pull request's Checks and reviews are as finished as it is, and they were two thirds of what
    /// a tick spent (#1588). A merged Delivery keeps its terminal `stage` without them, because
    /// `stage` reads `isMerged` before it reads either.
    ///
    /// A pull request CLOSED without merging pays for it: with no reviews and no checks read, its
    /// `stage` reads `pr` where it would have read `review` or `ci`. Nothing renders either today —
    /// `stage` has no caller and `DeliveryFacts` is built only by the specimens — so this costs no
    /// pixel now, and it is the reading to revisit before a surface draws a closed Delivery's
    /// checks. It is `isFinished` rather than `isMerged` because that is the terminal state the
    /// domain names, and a closed pull request's checks cannot move either.
    private func delivery(
        _ pull: GitHubPullRequest, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery {
        let pullRequest = pull.pullRequest
        guard !pullRequest.isFinished else {
            return Delivery(branch: pull.head.ref, pullRequest: pullRequest)
        }
        let runs: [GitHubCheckRuns.Run] = try await reads.pages(
            GitHubCheckRuns.self,
            of: "/repos/\(scope)/commits/\(pull.head.sha)/check-runs",
            grant: grant,
        )
        let rounds: [GitHubReviewRound] = try await reads.pages(
            [GitHubReviewRound].self,
            of: "/repos/\(scope)/pulls/\(pull.number)/reviews",
            grant: grant,
        )
        return Delivery(
            branch: pull.head.ref,
            pullRequest: pullRequest,
            observed: Delivery.Observed(
                checks: runs.map(\.check),
                reviews: rounds.map(\.review),
            ),
        )
    }
}

private extension CharacterSet {
    /// What may stand unencoded where a branch name is written into a query value.
    ///
    /// `urlQueryAllowed` minus the three that mean something TO a query rather than in it: `&` and
    /// `=` would let a branch name add a parameter of its own, and `+` reads back as a space. Git
    /// permits all three in a ref, so none of them is hypothetical. `#` is already out of
    /// `urlQueryAllowed`, and it is the one every Argo branch carries.
    ///
    /// `/` stays: it delimits nothing inside a query VALUE, and every branch here has one.
    static let branchInAQuery = urlQueryAllowed
        .subtracting(CharacterSet(charactersIn: "&=+"))
}
