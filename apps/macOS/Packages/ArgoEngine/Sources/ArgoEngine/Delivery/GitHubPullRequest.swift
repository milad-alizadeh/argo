import Foundation

/// One pull request as GitHub's REST API serves it, parsed at the boundary and nowhere else.
///
/// `mergedAt` and not a `merged` flag: the list endpoint carries the timestamp and omits the flag,
/// and a present timestamp is the same fact said in the shape GitHub actually sends.
struct GitHubPullRequest: Decodable {
    let number: Int
    let title: String
    /// GitHub's own word — `open` or `closed`. Carried verbatim, never folded together with
    /// `draft` or `mergedAt` into a state GitHub has no name for.
    let state: String
    let draft: Bool
    let mergedAt: String?
    let body: String?
    let htmlURL: String?
    let head: Ref
    let base: Ref

    /// One end of the pull request. `ref` is the branch name and `sha` the commit that addresses
    /// the Diff (ADR-0008).
    struct Ref: Decodable {
        let ref: String
        let sha: String
    }

    /// GitHub spells it `html_url`, which the snake-case decoding strategy turns into `htmlUrl`
    /// rather than `htmlURL` — so this one key is named rather than derived.
    enum CodingKeys: String, CodingKey {
        case number, title, state, draft, body, head, base
        case mergedAt
        case htmlURL = "htmlUrl"
    }

    var pullRequest: DeliveryPullRequest {
        DeliveryPullRequest(
            number: number,
            title: title,
            state: state,
            facts: DeliveryPullRequest.Facts(
                isDraft: draft,
                isMerged: mergedAt != nil,
                baseBranch: base.ref,
                headSHA: head.sha,
            ),
            body: body,
            url: htmlURL.flatMap(URL.init(string:)),
        )
    }
}
