import Foundation

/// The product in flight, assembled per branch from local git ∪ code host (`CONTEXT.md` L1 ·
/// Delivery).
///
/// Branch-keyed and derived, never persisted (ADR-0017). It holds no Sessions: they join to it by
/// `branch`, so a teammate's pull request has zero of them by construction.
public struct Delivery: Equatable, Sendable, Identifiable {
    /// The head branch, and the join key every other layer addresses this by (`CONTEXT.md` L3 ·
    /// Workspace).
    public let branch: String
    /// The host's pull request, and `nil` for a branch nobody has opened one for.
    public let pullRequest: DeliveryPullRequest?
    /// The observed checks, flat and in the host's own order. Empty means "no CI yet" — nothing
    /// local is ever run or parsed to fill it.
    public let checks: [DeliveryCheck]
    public let reviews: [DeliveryReview]
    /// What intent this branch serves, by the join precedence.
    public let ticket: DeliveryTicketLink

    public init(
        branch: String,
        pullRequest: DeliveryPullRequest?,
        observed: Observed = Observed(),
        ticket: DeliveryTicketLink = .unlinked,
    ) {
        self.branch = branch
        self.pullRequest = pullRequest
        self.checks = observed.checks
        self.reviews = observed.reviews
        self.ticket = ticket
    }

    /// What the host was observed to hold beyond the pull request itself.
    public struct Observed: Equatable, Sendable {
        public let checks: [DeliveryCheck]
        public let reviews: [DeliveryReview]

        public init(checks: [DeliveryCheck] = [], reviews: [DeliveryReview] = []) {
            self.checks = checks
            self.reviews = reviews
        }
    }

    public var id: String {
        branch
    }

    /// The same Delivery with its Ticket joined, `asserted` being what a human said this branch
    /// serves — consulted only where the derivation itself found nothing.
    public func linking(to asserted: Int?) -> Delivery {
        Delivery(
            branch: branch,
            pullRequest: pullRequest,
            observed: Observed(checks: checks, reviews: reviews),
            ticket: .derived(
                branch: branch, pullRequestBody: pullRequest?.body, asserted: asserted,
            ),
        )
    }

    /// The furthest lifecycle node this has reached, and never a reserved one.
    ///
    /// Read downward from the terminal state, because the nodes are cumulative: a merged Delivery
    /// also has checks and reviews, and it is at `merge`.
    public var stage: DeliveryStage {
        guard let pullRequest else { return .commits }
        if pullRequest.isMerged {
            return .merge
        }
        if !reviews.isEmpty {
            return .review
        }
        return checks.isEmpty ? .pr : .ci
    }
}
