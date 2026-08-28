@testable import ArgoEngine
import Foundation
import Testing

/// Enumerating a Linear team's Tickets through one Binding's grant — the port's second read,
/// and the one that proves the port is a port (#371).
@Suite("Linear Ticket listing")
struct LinearListingTests {
    private static func list(
        _ issues: [LinearIssueJSON],
    ) async throws
        -> ([Ticket], RecordedLinear) {
        let api = LinearFixture.holding(issues)
        let items = try await LinearTickets(transport: api).list(
            in: "team-eng", grant: .linear,
        )
        return (items, api)
    }

    @Test
    func `a ticket carries the team's own column word, never the category behind it`() async throws {
        // AC4: Linear's own status words render verbatim, with the canonical five staying an
        // internal bucket. Two tickets in `started` columns a team named differently must not
        // collapse into one word.
        let (items, _) = try await Self.list([
            LinearIssueJSON(number: 12, state: "In Review", category: "started"),
            LinearIssueJSON(number: 13, state: "Doing", category: "started"),
        ])

        #expect(items.map(\.status) == ["In Review", "Doing"])
        #expect(items.map(\.closure) == [.open, .open])
    }

    struct CategoryCase: Sendable {
        let category: String
        let closure: TicketClosure
        let canonical: TicketCanonicalState
    }

    /// Linear's six categories, and the one Argo does not know — which degrades to the quietest
    /// claim rather than to a closure nobody stated.
    private static let categories = [
        CategoryCase(category: "triage", closure: .open, canonical: .todo),
        CategoryCase(category: "backlog", closure: .open, canonical: .todo),
        CategoryCase(category: "unstarted", closure: .open, canonical: .todo),
        CategoryCase(category: "started", closure: .open, canonical: .inProgress),
        CategoryCase(category: "completed", closure: .resolved, canonical: .done),
        CategoryCase(category: "canceled", closure: .ruledOut, canonical: .closed),
        CategoryCase(category: "a category from 2029", closure: .open, canonical: .todo),
    ]

    @Test(arguments: categories)
    func `a column's category decides the closure, not its name`(
        _ testCase: CategoryCase,
    ) async throws {
        let (items, _) = try await Self.list([
            LinearIssueJSON(number: 12, state: "Whatever", category: testCase.category),
        ])

        #expect(items.first?.closure == testCase.closure)
        #expect(LinearWorkflowCategory(reading: testCase.category).canonical == testCase.canonical)
    }

    @Test
    func `a team that served no blocking edge says so, where GitHub can only stay silent`(
    ) async throws {
        // The divergence the two-provider case forces into the open. Linear serves the relations
        // WITH the issue, so an empty list is the provider saying there is nothing in the way —
        // `clear`, not the `unread` a GitHub issue with no dependency summary degrades to.
        let (items, _) = try await Self.list([LinearIssueJSON(number: 12)])

        #expect(items.first?.blockedBy == [])
        #expect(items.first?.blockage == .clear)
    }

    @Test
    func `a blocker arrives with its own closure, so a ruled-out edge strands the ticket`(
    ) async throws {
        let (items, _) = try await Self.list([
            LinearIssueJSON(number: 12, blockers: [(number: 9, category: "canceled")]),
        ])

        #expect(items.first?.blockedBy == [TicketBlocker(number: 9, closure: .ruledOut)])
        // Argo disagrees with Linear's own UI here: a cancelled blocker satisfies nothing.
        #expect(items.first?.blockage == .stranded)
    }

    @Test
    func `a relation that is not a blocking one is no edge at all`() async throws {
        // Linear serves `duplicate`, `related` and `similar` on the same connection, and reading
        // one as a dependency would block a ticket on a ticket nobody said it waited for.
        let (items, _) = try await Self.list([LinearIssueJSON(number: 12, related: [9])])

        #expect(items.first?.blockedBy == [])
    }

    @Test
    func `priority is the word Linear renders, and an unranked ticket has none`() async throws {
        let (items, _) = try await Self.list([
            LinearIssueJSON(number: 12, priority: "High"),
            LinearIssueJSON(number: 13),
        ])

        // Verbatim and in Linear's own case — Argo neither ranks these nor recases them. `No
        // priority` is Linear's word for an absence and reads as one rather than as a band.
        #expect(items.map(\.priority) == ["High", nil])
    }

    @Test
    func `a label's colour arrives bare, as GitHub's already does`() async throws {
        let (items, _) = try await Self.list([
            LinearIssueJSON(number: 12, labels: ["engine"], labelColours: ["engine": "#5E6AD2"]),
        ])

        #expect(items.first?.labels == [TicketLabel(name: "engine", colour: "5E6AD2")])
    }

    @Test
    func `a label Linear served no colour for keeps none`() async throws {
        let (items, _) = try await Self.list([
            LinearIssueJSON(number: 12, labels: ["engine"]),
        ])

        #expect(items.first?.labels.map(\.colour) == [nil])
    }

    @Test
    func `a team this identity cannot see is a failed read, never an empty backlog`() async {
        // Linear is GraphQL, so this arrives as a 200 with a null team rather than as a 404.
        let api = RecordedLinear(replies: ["query TeamIssues": #"{ "data": { "team": null } }"#])

        await #expect(throws: ProviderFetchError.unreachable) {
            try await LinearTickets(transport: api).list(in: "team-eng", grant: .linear)
        }
    }

    @Test
    func `a refused grant reaches the ledger as a refused grant`() async {
        let api = RecordedLinear(failure: HTTPTransportError.unauthorized(code: 401, reason: nil))

        await #expect(throws: ProviderFetchError.grantRefused) {
            try await LinearTickets(transport: api).list(in: "team-eng", grant: .linear)
        }
    }

    @Test
    func `a listing walks its pages to the end`() async throws {
        let api = RecordedLinear(replies: [
            "query TeamIssues": LinearIssueJSON.page([LinearIssueJSON(number: 12)]),
        ])
        _ = try await LinearTickets(transport: api).list(in: "team-eng", grant: .linear)

        // A page saying it is the last one ends the walk: one request, not the backstop's twenty.
        #expect(await api.documents().count == 1)
    }
}

extension AccountGrant {
    /// The grant every Linear read in these suites carries.
    static let linear = AccountGrant(accessToken: "lin_api_key", scopes: ["read"])
}
