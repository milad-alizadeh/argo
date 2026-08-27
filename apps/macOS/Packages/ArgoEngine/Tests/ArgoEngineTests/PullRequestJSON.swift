@testable import ArgoEngine
import Foundation

/// One pull request as GitHub serves it, written the way GitHub writes it — so a listing test
/// exercises the decoder rather than a convenient subset of it.
struct PullRequestJSON: Sendable {
    var number: Int
    var title = "A change"
    var state = "open"
    var draft = false
    var mergedAt: String?
    var body: String?
    var branch = "argo/#258-code-host"
    var base = "main"
    var headSHA = "c0ffee"

    var json: String {
        """
        { "number": \(number), "title": "\(title)", "state": "\(state)",
          "draft": \(draft),
          "merged_at": \(mergedAt.map { "\"\($0)\"" } ?? "null"),
          "body": \(body.map { "\"\($0)\"" } ?? "null"),
          "html_url": "\(Self.host)/\(number)",
          "head": { "ref": "\(branch)", "sha": "\(headSHA)" },
          "base": { "ref": "\(base)", "sha": "base5ha" } }
        """
    }

    /// The same pull request as a Delivery should hold it, spelled here rather than through the
    /// adapter — a test that built its expectation from the code under test would prove nothing.
    var read: DeliveryPullRequest {
        DeliveryPullRequest(
            number: number,
            title: title,
            state: state,
            facts: DeliveryPullRequest.Facts(
                isDraft: draft,
                isMerged: mergedAt != nil,
                baseBranch: base,
                headSHA: headSHA,
            ),
            body: body,
            url: URL(string: "\(Self.host)/\(number)"),
        )
    }

    private static let host = "https://github.com/acme/api/pull"

    static func list(_ pulls: [PullRequestJSON]) -> String {
        "[\(pulls.map(\.json).joined(separator: ","))]"
    }
}
