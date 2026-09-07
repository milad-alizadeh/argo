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
    public func delivery(
        ofBranch branch: String, in scope: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<Delivery?> {
        let owner = scope.prefix { $0 != "/" }
        let named = branch.addingPercentEncoding(withAllowedCharacters: .branchInAQuery) ?? branch
        return try await deliveries(
            listedBy: "/repos/\(scope)/pulls?state=all&sort=updated&direction=desc"
                + "&head=\(owner):\(named)",
            in: scope,
            grant: grant,
            revalidating: revalidating,
        ).map(\.first)
    }

    /// The listing, and one assembled Delivery per pull request in it.
    ///
    /// Only the LISTING is conditional. The check runs and the reviews below are asked outright
    /// every time, because a `304` on the listing is silent about them: a check run finishing does
    /// not touch the pull request it ran on, so the listing's body — and its ETag with it — stands
    /// still while CI moves. Answering the whole Delivery `unchanged` off the listing alone would
    /// freeze the one thing on an open pull request a person is watching. What a caller may opt
    /// into with `revalidating` is therefore narrow by construction: it holds nothing for this read
    /// whose parts can move on their own (#1620).
    private func deliveries(
        listedBy path: String, in scope: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<[Delivery]> {
        let listed = try await reads.pages(
            [GitHubPullRequest].self, of: path, grant: grant, revalidating: revalidating,
        )
        guard let pulls = listed.answer else { return .unchanged }
        var deliveries: [Delivery] = []
        for pull in pulls {
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
