import Foundation

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
    ///
    /// `nil` is every answer that established nothing, and it is the caller's cue to keep what it
    /// already held.
    public func read(
        titleOf number: Int, in scope: String, grant: AccountGrant,
    ) async
        -> TicketReading? {
        guard let data = try? await transport.send(HTTPRequest(
            url: "https://api.github.com/repos/\(scope)/issues/\(number)",
            bearerToken: grant.accessToken,
        )) else { return nil }
        return Self.reading(of: data)
    }

    /// The shape and not the status code, for the reason `GitHubScopeCheck` gives: the transport
    /// throws on a refused token and on a 5xx, and hands every other 4xx body through.
    ///
    /// So three shapes, not two. An issue is `.named`, GitHub's `Not Found` is `.absent`, and
    /// anything else it hands back — a rate-limit body, a validation error, an undocumented reply —
    /// established nothing and must NOT retire a title, or one throttled launch empties the rows.
    private static func reading(of body: Data) -> TicketReading? {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        if let issue = try? decoder.decode(IssueResponse.self, from: body) {
            // A pull request is a Delivery (`CONTEXT.md` L4) and not a Work Item, and a blank title
            // is a host that answered with nothing to show: no link either way.
            guard issue.pullRequest == nil, let title = Self.trimmed(issue.title) else {
                return .absent
            }
            return .named(title)
        }
        guard let failure = try? decoder.decode(FailureResponse.self, from: body)
        else { return nil }
        return failure.message == notFound ? .absent : nil
    }

    /// GitHub's own wording for a number behind which there is nothing this token can see. A
    /// private issue invisible to this token and one that does not exist are the same answer by
    /// design, and neither is worth a guess at which it was.
    private static let notFound = "Not Found"

    private static func trimmed(_ title: String) -> String? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// GitHub serves pull requests from `/issues/<N>` too, and `pullRequest` is the only field that
    /// tells the two apart.
    private struct IssueResponse: Decodable {
        let title: String
        let pullRequest: PullRequestMark?

        struct PullRequestMark: Decodable {
            let url: String
        }
    }

    private struct FailureResponse: Decodable {
        let message: String
    }
}
