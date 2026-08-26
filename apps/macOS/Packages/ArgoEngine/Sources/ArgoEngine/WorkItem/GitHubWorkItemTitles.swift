import Foundation

/// What the code host said when asked what a Work Item number is called.
///
/// Three cases and not an optional, because `CONTEXT.md`'s degrade-down rule needs two kinds of
/// "no title" told apart: a host that answered and has nothing behind this number, and a host that
/// did not answer at all. The first retires a title Argo was holding; the second must not, or an
/// outage would empty every row that had one.
public enum WorkItemTitleRead: Equatable, Sendable {
    case title(String)
    /// The host answered, and there is no Work Item title behind this number.
    case absent
    /// Nothing was established. Whatever Argo already held still stands.
    case unreadable
}

/// What a Work Item number is CALLED, read through a GitHub Binding (`CONTEXT.md` L1 · Work Item).
///
/// Argo stores the link and the provider owns the words, so this is the one thing fetched: the
/// title, for a number Argo already had.
public struct GitHubWorkItemTitles: Sendable {
    private let transport: HTTPTransport

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.transport = transport
    }

    /// `scope` is the Binding's own `owner/repo`, passed rather than looked up for the reason
    /// `ResolvedBinding` carries its grant: two Projects on two Accounts differ in nothing else.
    public func read(
        titleOf number: Int, in scope: String, grant: AccountGrant,
    ) async
        -> WorkItemTitleRead {
        guard let data = try? await transport.send(HTTPRequest(
            url: "https://api.github.com/repos/\(scope)/issues/\(number)",
            bearerToken: grant.accessToken,
        )) else { return .unreadable }
        return Self.read(body: data)
    }

    /// The shape and not the status code, for the reason `GitHubScopeCheck` gives: a 404's own body
    /// arrives here rather than throwing, and it decodes as no Work Item.
    private static func read(body: Data) -> WorkItemTitleRead {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard let issue = try? decoder.decode(IssueResponse.self, from: body),
              issue.pullRequest == nil,
              let title = SessionAnnotations.name(from: issue.title)
        else { return .absent }
        return .title(title)
    }

    /// GitHub serves pull requests from `/issues/<N>` too, and `pullRequest` is the only field that
    /// tells the two apart — a PR is a Delivery (`CONTEXT.md` L4), not a Work Item.
    private struct IssueResponse: Decodable {
        let title: String
        let pullRequest: PullRequestMark?

        struct PullRequestMark: Decodable {
            let url: String
        }
    }
}
