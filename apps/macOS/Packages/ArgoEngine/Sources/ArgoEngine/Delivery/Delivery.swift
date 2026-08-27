import Foundation

/// The product in flight, assembled per branch from local git ∪ code host (`CONTEXT.md` L1 ·
/// Delivery).
///
/// **Branch-keyed and derived, never persisted** (ADR-0017): the whole of it is re-read, so nothing
/// here can drift against the host it mirrors. It comes into existence at branch creation, which is
/// why a chat or planning Session with no branch has no Delivery at all.
///
/// **It holds no Sessions.** Sessions join to it by `branch` like everything else does, so a
/// teammate's pull request with no local Session is a Delivery with zero of them by construction
/// rather than by a stub.
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
    public let workItem: DeliveryWorkItemLink

    public init(
        branch: String,
        pullRequest: DeliveryPullRequest?,
        observed: Observed = Observed(),
        workItem: DeliveryWorkItemLink = .unlinked,
    ) {
        self.branch = branch
        self.pullRequest = pullRequest
        self.checks = observed.checks
        self.reviews = observed.reviews
        self.workItem = workItem
    }

    /// What the host was observed to hold beyond the pull request itself, grouped so the
    /// initializer stays inside the parameter cap.
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

    /// The furthest lifecycle node this has reached, and never a reserved one — nothing observes a
    /// deployment, so nothing may claim to be at `deploy` or `release`.
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
