@testable import ArgoEngine
import Foundation
import Testing

/// Enumerating a repository's Work Items through one Binding's grant — the read a Work room and a
/// poll are both built on (`CONTEXT.md` → Ports).
@Suite("Work Item listing")
struct WorkItemListingTests {
    private static let grant = AccountGrant(accessToken: "ghu_listing", scopes: ["repo"])

    private static func list(
        _ replies: [String: String],
    ) async throws
        -> ([WorkItem], RecordedIssues) {
        let api = RecordedIssues(replies: replies)
        let items = try await GitHubWorkItems(transport: api).list(in: "acme/api", grant: grant)
        return (items, api)
    }

    @Test
    func `a ticket carries the provider's own status word and its labels`() async throws {
        let issue = IssueJSON(
            number: 12,
            title: "Port the Work room",
            labels: ["engine", "swift"],
            assignees: ["octocat"],
        )
        let (items, _) = try await Self.list(["&page=1": IssueJSON.list([issue])])

        // The word renders verbatim (#272); the closure is what Argo groups across providers with.
        #expect(items.map(\.status) == ["open"])
        #expect(items.map(\.closure) == [.open])
        #expect(items.first?.title == "Port the Work room")
        #expect(items.first?.labels == ["engine", "swift"])
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
        let (items, _) = try await Self.list(["&page=1": IssueJSON.list([issue])])

        #expect(items.map(\.closure) == [example.closure])
    }

    @Test
    func `a pull request served from the issues path is not a Work Item`() async throws {
        // GitHub serves PRs from `/issues` too, and a PR is a Delivery (`CONTEXT.md` L4).
        let issues = [IssueJSON(number: 9, pullRequest: true), IssueJSON(number: 10)]
        let (items, _) = try await Self.list(["&page=1": IssueJSON.list(issues)])

        #expect(items.map(\.number) == [10])
    }

    @Test
    func `children come back in the provider's own order`() async throws {
        let parent = IssueJSON(number: 3, children: 2)
        let (items, _) = try await Self.list([
            "&page=1": IssueJSON.list([parent]),
            "sub_issues": IssueJSON.list([IssueJSON(number: 7), IssueJSON(number: 4)]),
        ])

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
        let (items, _) = try await Self.list([
            "&page=1": IssueJSON.list([blocked]),
            "blocked_by": IssueJSON.list(blockers),
        ])

        #expect(items.first?.blockedBy == [
            WorkItemBlocker(number: 1, closure: .ruledOut),
            WorkItemBlocker(number: 2, closure: .open),
        ])
        #expect(items.first?.blockage == .stranded)
    }

    @Test
    func `an issue with no edges costs no further requests`() async throws {
        let (_, api) = try await Self.list(["&page=1": IssueJSON.list([IssueJSON(number: 1)])])

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
    func `GitHub Issues carries no priority`() async throws {
        // A capability, known before any read — which is what a `nil` on one ticket could never
        // say. Projects carries a priority, on a board rather than on the issue.
        let (items, _) = try await Self.list(["&page=1": IssueJSON.list([IssueJSON(number: 1)])])

        #expect(GitHubWorkItems().carriesPriority == false)
        #expect(items.first?.priority == nil)
    }
}
