import Foundation

// The code host's pull request for one branch, as it holds it.

public struct DeliveryPullRequest: Equatable, Sendable {
    public let number: Int
    public let title: String
    /// The host's own state word, verbatim — GitHub's `open` and `closed`. Never normalized, and
    /// never merged with `isDraft` into a third word the host has no name for.
    public let state: String
    public let isDraft: Bool
    /// Whether the host says this landed. Merged is the Delivery's terminal state, and a closed
    /// pull request that was NOT merged is the other way a branch's life ends.
    public let isMerged: Bool
    /// The branch it merges into — the base a Diff is addressed against.
    public let baseBranch: String
    /// The commit at the head of the branch when the host last answered, which is what addresses
    /// the Diff (ADR-0008: refs are SHAs, never fabricated).
    public let headSHA: String
    /// The body, held for the closing references it carries and nothing else.
    public let body: String?
    /// The host's page for it, and `nil` where the host gave none.
    public let url: URL?

    public init(
        number: Int,
        title: String,
        state: String,
        facts: Facts,
        body: String?,
        url: URL?,
    ) {
        self.number = number
        self.title = title
        self.state = state
        self.isDraft = facts.isDraft
        self.isMerged = facts.isMerged
        self.baseBranch = facts.baseBranch
        self.headSHA = facts.headSHA
        self.body = body
        self.url = url
    }

    /// The four git-side facts.
    public struct Facts: Equatable, Sendable {
        public let isDraft: Bool
        public let isMerged: Bool
        public let baseBranch: String
        public let headSHA: String

        public init(isDraft: Bool, isMerged: Bool, baseBranch: String, headSHA: String) {
            self.isDraft = isDraft
            self.isMerged = isMerged
            self.baseBranch = baseBranch
            self.headSHA = headSHA
        }
    }
}
