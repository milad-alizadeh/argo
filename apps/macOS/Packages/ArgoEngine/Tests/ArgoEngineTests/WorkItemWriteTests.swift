@testable import ArgoEngine
import Foundation
import Testing

/// Which request GitHub takes for each canonical intent — the adapter's whole job, since the
/// interface says `transitionTo(.done)` and only this layer knows that GitHub spells it
/// `state: closed, state_reason: completed` (#167).
@Suite("Work Item writes")
struct WorkItemWriteTests {
    private static func write(
        _ intent: WorkItemIntent, replies: [String: String] = [:],
    ) async throws
        -> RecordedWrite {
        let api = RecordedGitHub(replies: Self.issues.merging(replies) { _, given in given })
        _ = try await GitHubWorkItems(transport: api).apply(intent, to: 12, through: .stub())
        return try #require(await api.writes().first)
    }

    private static let issues = [
        "/issues/12": IssueJSON(number: 12).json,
        "/issues/9": IssueJSON(number: 9).json,
        "/issues/3": IssueJSON(number: 3).json,
    ]

    @Test
    func `an edit of the prose is one patch of the issue`() async throws {
        let write = try await Self.write(
            .updateFields(WorkItemFields(title: "Port the Work room")),
        )

        #expect(write.method == .patch)
        #expect(write.path == "/repos/acme/api/issues/12")
        #expect(write.field("title") == "Port the Work room")
        // Absent rather than empty: an edit that named no body must not clear the one there is.
        #expect(write.field("body") == nil)
    }

    struct TransitionCase: Sendable {
        let state: WorkItemCanonicalState
        let issueState: String
        let reason: String
    }

    /// The bare tracker's whole workflow: open, and closed two ways.
    private static let transitions = [
        TransitionCase(state: .todo, issueState: "open", reason: "reopened"),
        TransitionCase(state: .done, issueState: "closed", reason: "completed"),
        TransitionCase(state: .closed, issueState: "closed", reason: "not_planned"),
    ]

    @Test(arguments: transitions)
    func `a canonical state resolves to GitHub's own mechanism`(
        _ example: TransitionCase,
    ) async throws {
        let write = try await Self.write(.transitionTo(example.state))

        #expect(write.method == .patch)
        #expect(write.field("state") == example.issueState)
        #expect(write.field("state_reason") == example.reason)
    }

    @Test
    func `a state GitHub cannot express costs no request at all`() async throws {
        // Refused before the wire, not by the provider: GitHub would take `state: closed` for an
        // `inProgress` it has no way to hold, and the ticket would then read a lie nothing could
        // tell from the truth.
        let api = RecordedGitHub(replies: Self.issues)

        await #expect(throws: WorkItemWriteError.inexpressible(.inProgress)) {
            try await GitHubWorkItems(transport: api)
                .apply(.transitionTo(.inProgress), to: 12, through: .stub())
        }
        #expect(await api.urls().isEmpty)
    }

    @Test
    func `closing names GitHub's own reason for it`() async throws {
        let closed = try await Self.write(.close(.ruledOut))

        #expect(closed.field("state") == "closed")
        #expect(closed.field("state_reason") == "not_planned")
    }

    @Test
    func `reopening clears the reason it was closed with`() async throws {
        let reopened = try await Self.write(.reopen)

        #expect(reopened.field("state") == "open")
        // Without it a reopened issue keeps the `state_reason` it was closed with, and would read
        // back as ruled out while sitting open.
        #expect(reopened.field("state_reason") == "reopened")
    }

    @Test
    func `a label is added by name`() async throws {
        let added = try await Self.write(.addLabel("engine"))

        #expect(added.method == .post)
        #expect(added.path == "/repos/acme/api/issues/12/labels")
        #expect(added.field("labels") == #"["engine"]"#)
    }

    @Test
    func `a removed label is escaped into the path`() async throws {
        // GitHub's labels carry spaces and slashes routinely, and this one goes in the path.
        let removed = try await Self.write(.removeLabel("needs review"))

        #expect(removed.method == .delete)
        #expect(removed.path == "/repos/acme/api/issues/12/labels/needs%20review")
    }

    @Test
    func `a blocker edge names the far ticket by its database id`() async throws {
        // GitHub's dependency endpoints take the id and never the number, and every number Argo
        // holds is the one a human reads — so the adapter looks the id up rather than sending the
        // number and hoping.
        let added = try await Self.write(.addBlockedBy(9))

        #expect(added.method == .post)
        #expect(added.path == "/repos/acme/api/issues/12/dependencies/blocked_by")
        #expect(added.field("issue_id") == "\(IssueJSON.identifier(of: 9))")
    }

    @Test
    func `a cleared blocker edge carries that id in the path`() async throws {
        let removed = try await Self.write(.removeBlockedBy(9))

        #expect(removed.method == .delete)
        #expect(removed.path
            == "/repos/acme/api/issues/12/dependencies/blocked_by/\(IssueJSON.identifier(of: 9))")
    }

    @Test
    func `parenting is put to the parent and names the child`() async throws {
        // The opposite way round from every other intent: GitHub's sub-issue endpoints hang off
        // the PARENT, so the subject of the write is the ticket that was not asked about.
        let set = try await Self.write(.setParent(3))

        #expect(set.method == .post)
        #expect(set.path == "/repos/acme/api/issues/3/sub_issues")
        #expect(set.field("sub_issue_id") == "\(IssueJSON.identifier(of: 12))")
        // GitHub refuses a sub-issue that already has a different parent without it, and
        // re-parenting is the common act — a refusal this port does not retry out of.
        #expect(set.field("replace_parent") == "true")
    }

    @Test
    func `unparenting is put to the parent it names`() async throws {
        let removed = try await Self.write(.removeParent(3))

        #expect(removed.method == .delete)
        #expect(removed.path == "/repos/acme/api/issues/3/sub_issue")
        #expect(removed.field("sub_issue_id") == "\(IssueJSON.identifier(of: 12))")
    }

    @Test
    func `a priority GitHub has no field for is written as the label it is read from`(
    ) async throws {
        // The read derives priority from a scoped label (`GitHubIssue+Priority`); a control offered
        // against a fact the room already draws has to be able to change it.
        let issue = IssueJSON(number: 12, labels: ["priority/low", "engine"])
        let api = RecordedGitHub(replies: ["/issues/12": issue.json])
        _ = try await GitHubWorkItems(transport: api).apply(
            .setPriority("High"), to: 12, through: .stub(),
        )
        let writes = await api.writes()

        // The old label goes first, whatever the repository spelled it with, so the ticket cannot
        // end up carrying two priorities — which the read resolves to none.
        #expect(writes.map(\.method) == [.delete, .post])
        #expect(writes.first?.path == "/repos/acme/api/issues/12/labels/priority%2Flow")
        #expect(writes.last?.field("labels") == #"["priority:High"]"#)
    }

    @Test
    func `a created ticket carries its title, body and type`() async throws {
        let api = RecordedGitHub(replies: ["/issues": IssueJSON(number: 101).json])
        _ = try await GitHubWorkItems(transport: api).create(
            WorkItemDraft(title: "Port the Work room", body: "Phase 5", type: "Task"),
            through: .stub(),
        )
        let write = try #require(await api.writes().first)

        #expect(write.method == .post)
        #expect(write.path == "/repos/acme/api/issues")
        #expect(write.field("title") == "Port the Work room")
        #expect(write.field("body") == "Phase 5")
        #expect(write.field("type") == "Task")
    }
}
