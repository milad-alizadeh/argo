@testable import ArgoEngine
import Foundation
import Testing

/// The bounded read of a Project's CLOSED Tickets — the listing no poll makes and no `list` can
/// serve, because closed is unbounded where open is not (#1075).
@Suite("Closed ticket listing")
struct ClosedTicketListingTests {
    private static func page(
        _ replies: [String: String], after cursor: String? = nil,
    ) async throws
        -> (ClosedTicketPage, RecordedGitHub) {
        let api = RecordedGitHub(replies: replies)
        let page = try await GitHubTickets(transport: api)
            .closed(in: "acme/api", after: cursor, grant: .listing)
        return (page, api)
    }

    /// Enough closed issues to fill a page, so a suite about the CURSOR does not have to spell
    /// fifty of them.
    private static func full(from first: Int = 1) -> [IssueJSON] {
        (0 ..< ClosedTicketPage.size).map {
            IssueJSON(number: first + $0, state: "closed", reason: "completed")
        }
    }

    // MARK: - What the host is asked for

    /// The order is asked of the HOST, which is what makes the paging honest: the page boundary and
    /// the row order are then the same order.
    @Test
    func `the closed listing is asked for last touched first, one page at a time`() async throws {
        let (_, api) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list([]),
        ])

        let asked = try #require(await api.urls().first)
        #expect(asked.contains("state=closed"))
        #expect(asked.contains("sort=updated&direction=desc"))
        #expect(asked.contains("per_page=\(ClosedTicketPage.size)"))
    }

    /// The bound in one line: one request, whatever the repository holds.
    @Test
    func `opening the closed listing costs exactly one request`() async throws {
        let (_, api) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list(Self.full()),
        ])

        #expect(await api.urls().count == 1)
    }

    /// Most of what keeps this cheap next to `list`, which spends a request per declared edge per
    /// issue. A closed ticket's blockers are nobody's question.
    @Test
    func `the closed listing reads no edges, whatever the summaries declare`() async throws {
        let issue = IssueJSON(
            number: 12,
            state: "closed",
            reason: "completed",
            children: 3,
            blockers: 2,
        )
        let (page, api) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list([issue]),
        ])

        #expect(await api.urls().count == 1)
        #expect(await !api.urls().contains { $0.contains("sub_issues") })
        #expect(await !api.urls().contains { $0.contains("blocked_by") })
        // The absence renders as an absence: `nil` edges draw no blockage mark, and no children
        // draw no roll-up — never a `0/N` nobody established.
        #expect(page.items.first?.blockedBy == nil)
        #expect(page.items.first?.children.isEmpty == true)
    }

    // MARK: - The cursor

    @Test
    func `a short page is the last page and carries no cursor`() async throws {
        let (page, _) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list([
                IssueJSON(number: 3, state: "closed", reason: "completed"),
            ]),
        ])

        #expect(page.items.map(\.number) == [3])
        #expect(page.next == nil)
    }

    @Test
    func `a full page carries the cursor for the one behind it`() async throws {
        let (page, _) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list(Self.full()),
        ])

        #expect(page.items.count == ClosedTicketPage.size)
        #expect(page.next == "2")
    }

    /// A page whose pull requests were dropped is SHORT without being last. Deciding the cursor on
    /// the filtered count would strand every closed ticket behind the first repository that files
    /// pull requests faster than issues.
    @Test
    func `dropping a pull request shortens a page without ending it`() async throws {
        var issues = Self.full()
        issues[0].pullRequest = true
        issues[1].pullRequest = true
        let (page, _) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list(issues),
        ])

        #expect(page.items.count == ClosedTicketPage.size - 2)
        #expect(page.next == "2")
    }

    @Test
    func `a cursor resumes at the page it names`() async throws {
        let (page, api) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list(Self.full()),
            RecordedGitHub.closedIssues(page: 2): IssueJSON.list([
                IssueJSON(number: 900, state: "closed", reason: "not_planned"),
            ]),
        ], after: "2")

        #expect(page.items.map(\.number) == [900])
        #expect(await api.urls().allSatisfy { $0.contains("page=2") })
    }

    /// A cursor this adapter did not write is not a page number, and the read starts at the first
    /// page rather than at whatever `Int("")` would have been.
    @Test
    func `a cursor the adapter cannot read starts at the first page`() async throws {
        let (_, api) = try await Self.page([
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list([]),
        ], after: "not-a-page")

        #expect(await api.urls().allSatisfy { $0.contains("page=1") })
    }

    // MARK: - Linear

    private static func linear(
        _ issues: [LinearIssueJSON], hasNext: Bool = false, after cursor: String? = nil,
    ) async throws
        -> (ClosedTicketPage, RecordedLinear) {
        let api = RecordedLinear(
            replies: ["query TeamClosedIssues": LinearIssueJSON.page(issues, hasNext: hasNext)],
        )
        let page = try await LinearTickets(transport: api)
            .closed(in: "team-eng", after: cursor, grant: ResolvedBinding.linear().grant)
        return (page, api)
    }

    /// Linear says "closed" as two timestamps rather than as a state word, and the closed document
    /// is the exact complement of the listing's: EITHER set, where the listing wants both null.
    @Test
    func `Linear is asked for the issues either closure timestamp is set on`() async throws {
        let (_, api) = try await Self.linear([])

        let document = try #require(await api.documents().first)
        #expect(document.contains("completedAt: { null: false }"))
        #expect(document.contains("canceledAt: { null: false }"))
        #expect(document.contains("orderBy: updatedAt"))
    }

    @Test
    func `Linear is asked for one page of the stated size`() async throws {
        let (_, api) = try await Self.linear([])

        let variables = try #require(await api.variables(of: "query TeamClosedIssues"))
        #expect(variables["first"] == .int(ClosedTicketPage.size))
        #expect(variables["after"] == .null)
    }

    @Test
    func `Linear's page info becomes the cursor`() async throws {
        let issue = LinearIssueJSON(number: 4, state: "Done", category: "completed")
        let (page, _) = try await Self.linear([issue], hasNext: true)

        #expect(page.items.map(\.number) == [4])
        #expect(page.next == "next")
    }

    @Test
    func `Linear resumes at the cursor it was handed`() async throws {
        let (_, api) = try await Self.linear([], after: "next")

        let variables = try #require(await api.variables(of: "query TeamClosedIssues"))
        #expect(variables["after"] == .string("next"))
    }

    // MARK: - Both adapters

    /// The two closed buckets stay APART on the way through the port, which is what lets the row
    /// draw each as itself rather than folding both into "closed" (`TicketClosure`).
    @Test(arguments: ReadAdapter.allCases)
    func `resolved and ruled out come back as themselves`(_ adapter: ReadAdapter) async throws {
        let binding = adapter.binding
        let page = try await adapter.closedPort().closed(
            in: binding.binding.scope, after: nil, grant: binding.grant,
        )

        #expect(page.items.map(\.closure) == [.resolved, .ruledOut])
    }
}
