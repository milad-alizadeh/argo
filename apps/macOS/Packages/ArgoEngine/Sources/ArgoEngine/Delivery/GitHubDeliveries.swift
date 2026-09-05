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

    public func inFlight(in scope: String, grant: AccountGrant) async throws -> [Delivery] {
        try await deliveries(
            listedBy: "/repos/\(scope)/pulls?state=open", in: scope, grant: grant,
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
        ofBranch branch: String, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery? {
        let owner = scope.prefix { $0 != "/" }
        let named = branch.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? branch
        return try await deliveries(
            listedBy: "/repos/\(scope)/pulls?state=all&sort=updated&direction=desc"
                + "&head=\(owner):\(named)",
            in: scope,
            grant: grant,
        ).first
    }

    private func deliveries(
        listedBy path: String, in scope: String, grant: AccountGrant,
    ) async throws
        -> [Delivery] {
        let pulls: [GitHubPullRequest] = try await reads.pages(
            [GitHubPullRequest].self, of: path, grant: grant,
        )
        var deliveries: [Delivery] = []
        for pull in pulls {
            try await deliveries.append(delivery(pull, in: scope, grant: grant))
        }
        return deliveries
    }

    private func delivery(
        _ pull: GitHubPullRequest, in scope: String, grant: AccountGrant,
    ) async throws
        -> Delivery {
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
            pullRequest: pull.pullRequest,
            observed: Delivery.Observed(
                checks: runs.map(\.check),
                reviews: rounds.map(\.review),
            ),
        )
    }
}
