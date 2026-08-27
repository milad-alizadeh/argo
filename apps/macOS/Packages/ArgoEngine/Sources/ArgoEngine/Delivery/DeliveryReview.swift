import Foundation

/// One submitted review round against a Delivery (`CONTEXT.md` L4 · Review).
public struct DeliveryReview: Equatable, Sendable {
    /// Who submitted it, as the host spells their login, and `nil` where the host named nobody —
    /// a review whose author's account is gone is still a review it serves.
    public let author: String?
    /// The host's own verdict word, verbatim and in its own case. GitHub shouts `APPROVED`; Argo
    /// neither recases it nor maps it onto a vocabulary of its own, because a renamed verdict is a
    /// claim about a review nobody submitted.
    public let verdict: String
    /// The commit the round was submitted against, which is the only stable ref a Diff has
    /// (ADR-0008). `nil` where the host named none.
    public let reviewedSHA: String?

    public init(author: String?, verdict: String, reviewedSHA: String?) {
        self.author = author
        self.verdict = verdict
        self.reviewedSHA = reviewedSHA
    }
}
