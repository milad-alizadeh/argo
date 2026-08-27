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

    /// `state=all`, because merge is a Delivery's terminal state and a listing of open pull
    /// requests alone could never reach it. Most-recently-updated first, so the page backstop in
    /// `GitHubReads` truncates the long-settled rather than what is in flight.
    public func deliveries(in scope: String, grant: AccountGrant) async throws -> [Delivery] {
        let pulls: [GitHubPullRequest] = try await reads.pages(
            of: "/repos/\(scope)/pulls?state=all&sort=updated&direction=desc"
                + "&per_page=\(GitHubReads.pageSize)",
            grant: grant,
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
        let runs: GitHubCheckRuns = try await reads.get(
            "/repos/\(scope)/commits/\(pull.head.sha)/check-runs"
                + "?per_page=\(GitHubReads.pageSize)",
            grant: grant,
        )
        let rounds: [GitHubReviewRound] = try await reads.get(
            "/repos/\(scope)/pulls/\(pull.number)/reviews?per_page=\(GitHubReads.pageSize)",
            grant: grant,
        )
        return Delivery(
            branch: pull.head.ref,
            pullRequest: pull.pullRequest,
            observed: Delivery.Observed(
                checks: runs.checkRuns.map(\.check),
                reviews: rounds.map(\.review),
            ),
        )
    }
}
