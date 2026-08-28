@testable import ArgoEngine
import Foundation
import Testing

/// The two places a Binding meets the Linear adapter: the poll deciding which port to read
/// through, and the picker asking what this identity could be bound to (#371).
@Suite("Linear binding")
struct LinearBindingTests {
    @Test
    func `a poll on a Linear Binding reads Linear, and one on GitHub reads GitHub`() async throws {
        // The one outcome worth ruling out is a grant reaching the other provider's host — which
        // is why the poll takes a Binding rather than a scope and a token (`WorkItemReading`).
        let linear = StubProviderAPI(body: LinearIssueJSON.page([]))
        let github = StubProviderAPI(body: "[]")

        _ = try await ProviderWorkItems(transport: linear).list(through: .linear())
        _ = try await ProviderWorkItems(transport: github).list(through: .stub())

        #expect(await linear.urls() == [LinearAPI.endpoint])
        #expect(await github.urls().allSatisfy { $0.hasPrefix(GitHubOAuthApp.apiHost) })
    }

    @Test
    func `the picker offers the team ids a Linear account can see`() async {
        let teams = """
        { "data": { "teams": { "nodes": [
          { "id": "team-eng", "key": "ENG", "name": "Engineering" },
          { "id": "team-des", "key": "DES", "name": "Design" }
        ] } } }
        """

        let catalogue = await ProviderScopeCatalog(transport: StubProviderAPI(body: teams))
            .scopes(for: Self.query)

        // The id and not the name: a Binding's scope is what `LinearScopeCheck` validates and what
        // the adapter reads with, and two workspaces can both hold an `Engineering`.
        #expect(catalogue == .listed(["team-eng", "team-des"], truncated: false))
    }

    @Test
    func `a refused Linear grant reads as unauthorized rather than as an empty workspace`(
    ) async {
        let api = StubProviderAPI(failure: .unauthorized(code: 401, reason: nil))

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query)

        // An empty picker rendered on a refusal would claim the workspace holds no teams
        // (`CONTEXT.md` L2 · degrade-down).
        #expect(catalogue == .unauthorized)
    }

    @Test
    func `a Linear workspace that could not be read says so`() async {
        let api = StubProviderAPI(failure: .status(code: 503))

        let catalogue = await ProviderScopeCatalog(transport: api).scopes(for: Self.query)

        #expect(catalogue == .unreadable("Linear could not be reached."))
    }

    private static let query = ScopeQuery(
        port: .workItem, provider: .linear, grant: .linear,
    )
}
