import Foundation

/// One submitted review round as GitHub serves it, parsed at the boundary and nowhere else.
struct GitHubReviewRound: Decodable {
    /// Absent for a review whose author's account is gone, which is a review GitHub still serves.
    let user: User?
    /// GitHub's own verdict word, shouted — `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`,
    /// `DISMISSED`. Carried through in its own case (`CONTEXT.md` L4 · Review).
    let state: String
    let commitID: String?

    struct User: Decodable {
        let login: String
    }

    /// GitHub spells it `commit_id`, which the snake-case strategy turns into `commitId` rather
    /// than `commitID` — so this one key is named rather than derived.
    enum CodingKeys: String, CodingKey {
        case user, state
        case commitID = "commitId"
    }

    var review: DeliveryReview {
        DeliveryReview(author: user?.login, verdict: state, reviewedSHA: commitID)
    }
}
