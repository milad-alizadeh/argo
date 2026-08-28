@testable import ArgoEngine
import Foundation
import Testing

/// Enumerating a repository's Work Items through one Binding's grant — the read a Work room and a
/// poll are both built on (`CONTEXT.md` → Ports).
@Suite("Work Item listing")
struct WorkItemListingTests {
    private static func list(
        _ replies: [String: String],
    ) async throws
        -> ([WorkItem], RecordedGitHub) {
        let api = RecordedGitHub(replies: replies)
        let items = try await GitHubWorkItems(transport: api).list(in: "acme/api", grant: .listing)
        return (items, api)
    }

    /// One page of open issues, and whatever the edges off them answer.
    private static func listing(
        _ issues: [IssueJSON], edges: [String: String] = [:],
    ) async throws
        -> ([WorkItem], RecordedGitHub) {
        try await list(edges.merging([RecordedGitHub.openIssues: IssueJSON.list(issues)]) { $1 })
    }

    @Test
    func `a ticket carries the provider's own status word and its labels`() async throws {
        let issue = IssueJSON(
            number: 12,
            title: "Port the Work room",
            labels: ["engine", "swift"],
            assignees: ["octocat"],
        )
        let (items, _) = try await Self.listing([issue])

        // The word renders verbatim (#272); the closure is what Argo groups across providers with.
        #expect(items.map(\.status) == ["open"])
        #expect(items.map(\.closure) == [.open])
        #expect(items.first?.title == "Port the Work room")
        #expect(items.first?.labels.map(\.name) == ["engine", "swift"])
        #expect(items.first?.assignees == ["octocat"])
    }

    struct ClosureCase: Sendable {
        let state: String
        let reason: String?
        let closure: WorkItemClosure
    }

    /// GitHub added `state_reason` after the fact, so an old closure carries none and the two kinds
    /// genuinely cannot be told apart.
    private static let closures = [
        ClosureCase(state: "closed", reason: "completed", closure: .resolved),
        ClosureCase(state: "closed", reason: "not_planned", closure: .ruledOut),
        ClosureCase(state: "closed", reason: "duplicate", closure: .ruledOut),
        ClosureCase(state: "closed", reason: nil, closure: .closedUnreadably),
        ClosureCase(state: "open", reason: nil, closure: .open),
    ]

    @Test(arguments: closures)
    func `GitHub's closure kind decides the closure`(_ example: ClosureCase) async throws {
        let issue = IssueJSON(number: 1, state: example.state, reason: example.reason)
        let (items, _) = try await Self.listing([issue])

        #expect(items.map(\.closure) == [example.closure])
    }

    @Test
    func `a pull request served from the issues path is not a Work Item`() async throws {
        // GitHub serves PRs from `/issues` too, and a PR is a Delivery (`CONTEXT.md` L4).
        let issues = [IssueJSON(number: 9, pullRequest: true), IssueJSON(number: 10)]
        let (items, _) = try await Self.listing(issues)

        #expect(items.map(\.number) == [10])
    }

    @Test
    func `children come back in the provider's own order`() async throws {
        let parent = IssueJSON(number: 3, children: 2)
        let (items, _) = try await Self.listing(
            [parent],
            edges: ["sub_issues": IssueJSON.list([IssueJSON(number: 7), IssueJSON(number: 4)])],
        )

        #expect(items.first?.children == [7, 4])
    }

    @Test
    func `each blocker carries the closure it was verified at`() async throws {
        // The summary counts open blockers only, so a listing built on it could not tell a
        // cleared edge from one whose blocker was cancelled.
        let blocked = IssueJSON(number: 5, blockers: 2)
        let blockers = [
            IssueJSON(number: 1, state: "closed", reason: "not_planned"),
            IssueJSON(number: 2, state: "open"),
        ]
        let (items, _) = try await Self.listing(
            [blocked],
            edges: ["blocked_by": IssueJSON.list(blockers)],
        )

        #expect(items.first?.blockedBy == [
            WorkItemBlocker(number: 1, closure: .ruledOut),
            WorkItemBlocker(number: 2, closure: .open),
        ])
        #expect(items.first?.blockage == .stranded)
    }

    @Test
    func `an issue with no edges costs no further requests`() async throws {
        let (_, api) = try await Self.listing([IssueJSON(number: 1)])

        #expect(await api.urls().count == 1)
    }

    @Test
    func `a full page is followed by the next one`() async throws {
        let full = (1 ... 100).map { IssueJSON(number: $0) }
        let (items, api) = try await Self.list([
            "&page=1": IssueJSON.list(full),
            "&page=2": IssueJSON.list([IssueJSON(number: 101)]),
        ])

        #expect(items.count == 101)
        #expect(await api.urls().count == 2)
    }

    @Test
    func `only open Work Items are listed`() async throws {
        // A closed ticket has left the room, and asking for every issue a repository ever had
        // costs a poll two extra requests per issue on edges nobody is waiting on.
        let (_, api) = try await Self.listing([IssueJSON(number: 1)])

        #expect(await api.urls().allSatisfy { $0.contains("state=open") })
    }
}
