@testable import ArgoEngine
import Foundation
import Testing

/// The per-ticket facts one listing request already answers — priority, type, body, and whether the
/// host said anything about dependency edges at all.
///
/// Every one of them degrades to ABSENT rather than to a default, which is what stops the room
/// rendering a word no tracker said (`CONTEXT.md` L2 · degrade-down).
@Suite("Work Item facts")
struct WorkItemFactsTests {
    private static func list(_ issues: [IssueJSON]) async throws -> [WorkItem] {
        let api = RecordedIssues(replies: ["&page=1": IssueJSON.list(issues)])
        return try await GitHubWorkItems(transport: api).list(in: "acme/api", grant: .listing)
    }

    private static func first(_ issue: IssueJSON) async throws -> WorkItem {
        try #require(await list([issue]).first)
    }

    @Test
    func `a ticket the provider said nothing else about carries none of the facts`() async throws {
        let item = try await Self.first(IssueJSON(number: 1))

        #expect(item.priority == nil)
        #expect(item.type == nil)
        #expect(item.body == nil)
    }

    struct PriorityCase: Sendable {
        let labels: [String]
        let priority: String?
    }

    /// GitHub has no priority field, so the adapter reads the one place a repository can state one:
    /// a scoped label. The word is the tracker's, in the tracker's own case.
    private static let priorities = [
        PriorityCase(labels: ["priority: high"], priority: "high"),
        PriorityCase(labels: ["priority:high"], priority: "high"),
        PriorityCase(labels: ["priority/high"], priority: "high"),
        PriorityCase(labels: ["Priority: High"], priority: "High"),
        // Two words, and no standing to pick one.
        PriorityCase(labels: ["priority: high", "priority: low"], priority: nil),
        // The scope with nothing after it names no word.
        PriorityCase(labels: ["priority:"], priority: nil),
        // A topic label that merely starts with the letters, which is why `-` is not a separator.
        PriorityCase(labels: ["priority-work", "prioritise"], priority: nil),
        PriorityCase(labels: ["bug", "wayfinder:map"], priority: nil),
    ]

    @Test(arguments: priorities)
    func `priority is read off a scoped label, verbatim`(_ example: PriorityCase) async throws {
        let item = try await Self.first(IssueJSON(number: 1, labels: example.labels))

        #expect(item.priority == example.priority)
    }

    /// Reading one as a priority does not consume it: the fact strip draws every label the provider
    /// served, the one the word came off included (`cockpit-work-room.md`).
    @Test
    func `a label read as a priority is still a label`() async throws {
        let item = try await Self.first(IssueJSON(number: 1, labels: ["bug", "priority: high"]))

        #expect(item.labels == ["bug", "priority: high"])
    }

    @Test
    func `the type is GitHub's own word, and never a label standing in for one`() async throws {
        let item = try await Self.first(IssueJSON(number: 1, labels: ["prd"], type: "PRD"))

        #expect(item.type == "PRD")
    }

    @Test
    func `a repository with issue types turned off has no type to read`() async throws {
        let item = try await Self.first(IssueJSON(number: 1, labels: ["prd"]))

        #expect(item.type == nil)
    }

    @Test
    func `the body arrives with the listing`() async throws {
        let item = try await Self.first(IssueJSON(number: 1, body: "What to build."))

        #expect(item.body == "What to build.")
    }

    @Test
    func `a blank body is no body`() async throws {
        let item = try await Self.first(IssueJSON(number: 2, body: "   "))

        #expect(item.body == nil)
    }

    @Test
    func `a host serving a dependency summary has read this ticket's edges`() async throws {
        let none = try await Self.first(IssueJSON(number: 1))

        // Zero blockers is an ANSWER: the host was asked and said there are none.
        #expect(none.blockedBy == [])
    }

    @Test
    func `a host serving no dependency summary leaves the edges unread`() async throws {
        let item = try await Self.first(IssueJSON(number: 1, dependencies: false))

        // Absent, not empty — and every claim built on the edges is suppressed above this.
        #expect(item.blockedBy == nil)
    }
}
