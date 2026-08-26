@testable import ArgoEngine
import Foundation
import Testing

/// Resolving `#<N>` to the words the code host holds (#745), against recorded GitHub bodies. The
/// shape decides the answer rather than the status code, for the reason `GitHubScopeCheck` gives.
@Suite("Work Item title read")
struct WorkItemTitleReadTests {
    private static let grant = AccountGrant(accessToken: "ghu_personal", scopes: ["repo"])

    private static func read(
        body: String = "{}", failure: HTTPTransportError? = nil, number: Int = 745,
    ) async
        -> (WorkItemTitleRead, StubProviderAPI) {
        let api = StubProviderAPI(body: body, failure: failure)
        let read = await GitHubWorkItemTitles(transport: api)
            .read(titleOf: number, in: "milad/argo", grant: grant)
        return (read, api)
    }

    @Test
    func `a ticket the token can read answers with its own title`() async {
        let (read, api) = await Self.read(body: #"{ "number": 745, "title": "Derive the link" }"#)

        #expect(read == .title("Derive the link"))
        #expect(await api.urls() == ["https://api.github.com/repos/milad/argo/issues/745"])
        #expect(await api.bearerTokens() == ["ghu_personal"])
    }

    @Test
    func `a number the host has nothing behind reads as absent`() async {
        // GitHub's 404 body, which `URLSessionTransport` hands through rather than throwing.
        let (read, _) = await Self.read(body: #"{ "message": "Not Found" }"#, number: 999_999)

        // Absent and not unreadable: the host answered, so a title Argo was holding is retired.
        #expect(read == .absent)
    }

    @Test
    func `a pull request number is not a Work Item`() async {
        // GitHub serves PRs from the same `/issues/<N>` path, and a PR title in the ticket rung
        // would name a Delivery where the row claims a Work Item (`CONTEXT.md` L1, L4).
        let (read, _) = await Self.read(
            body: #"{ "number": 740, "title": "A merged PR", "pull_request": { "url": "u" } }"#,
        )

        #expect(read == .absent)
    }

    @Test
    func `a ticket whose title is blank reads as absent`() async {
        // A row reading `#745 — ` says the provider answered and had nothing to say.
        let (read, _) = await Self.read(body: #"{ "number": 745, "title": "   " }"#)

        #expect(read == .absent)
    }

    @Test
    func `a refused token establishes nothing`() async {
        let (read, _) = await Self.read(failure: .unauthorized(code: 401))

        #expect(read == .unreadable)
    }

    @Test
    func `a code host that cannot be reached establishes nothing`() async {
        let (read, _) = await Self.read(failure: .status(code: 503))

        // Unreadable and not absent: an outage must not empty the rows that already had a title.
        #expect(read == .unreadable)
    }
}
