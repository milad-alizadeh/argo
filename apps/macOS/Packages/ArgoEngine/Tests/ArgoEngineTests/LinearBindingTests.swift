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
    func `a Linear Work Item port and a GitHub code host fail independently`() async {
        // AC2. Health is keyed on the Binding, so a Linear workspace that has gone down must leave
        // the GitHub code host reading healthy — and a reconnect on one Account must not clear a
        // refusal recorded against the other (#569).
        let ledger = ConnectionHealthLedger()
        let workItem = PortReadTarget(binding: .linear(), projectID: "P1")
        let codeHost = PortReadTarget(binding: .stub(), projectID: "P1")

        await ledger.succeeded(codeHost.projectBinding, in: "P1", at: Date())
        await ledger.record(.unreachable, of: workItem)

        #expect(await ledger.health(of: workItem.projectBinding, in: "P1").state != .healthy)
        #expect(await ledger.health(of: codeHost.projectBinding, in: "P1").state == .healthy)
    }

    @Test
    func `reconnecting one account leaves the other's refusal standing`() async {
        let ledger = ConnectionHealthLedger()
        let workItem = PortReadTarget(binding: .linear(), projectID: "P1")
        let codeHost = PortReadTarget(binding: .stub(), projectID: "P1")

        await ledger.record(.grantRefused, of: workItem)
        await ledger.record(.grantRefused, of: codeHost)
        // The Linear identity is authorized again. GitHub's refusal is a different Account's.
        await ledger.reconnected(workItem.projectBinding.accountID)

        #expect(await ledger.health(of: workItem.projectBinding, in: "P1").state != .needsReconnect)
        #expect(await ledger.health(of: codeHost.projectBinding, in: "P1").state == .needsReconnect)
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
