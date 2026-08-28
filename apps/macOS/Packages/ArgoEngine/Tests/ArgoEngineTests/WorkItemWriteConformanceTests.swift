@testable import ArgoEngine
import Foundation
import Testing

/// The Work Item adapters the write conformance suite runs against.
///
/// `GitHubWorkItems` is the shipped one; `WorkflowTracker` stands for the workflow-capable half of
/// the port (Linear, Jira) that has no adapter yet. Two, because a suite run against one adapter
/// only ever proves things about that adapter — the gaps sit in different places on each, which is
/// what makes "declared, not discovered by failing" a claim about the PORT.
enum WriteAdapter: String, CaseIterable, Sendable {
    case gitHub
    case workflow

    /// A port holding ticket 12, and the two an edge intent names at its far end.
    func port() -> WorkItemWriting {
        switch self {
        case .gitHub:
            GitHubWorkItems(transport: RecordedGitHub(replies: [
                "/issues/12": IssueJSON(number: 12, title: "Port the Work room").json,
                "/issues/9": IssueJSON(number: 9).json,
                "/issues/3": IssueJSON(number: 3).json,
            ]))
        case .workflow:
            WorkflowTracker(holding: [
                WorkItem(number: 12, title: "Port the Work room", status: "Todo", closure: .open),
            ])
        }
    }

    /// A port holding nothing, which answers a create with the ticket it filed.
    func empty() -> WorkItemWriting {
        switch self {
        case .gitHub:
            GitHubWorkItems(transport: RecordedGitHub(replies: [
                "/issues": IssueJSON(number: 101, title: "A new ticket").json,
            ]))
        case .workflow:
            WorkflowTracker()
        }
    }
}

@Suite("Work Item write conformance")
struct WorkItemWriteConformanceTests {
    @Test(arguments: WriteAdapter.allCases)
    func `a write answers with the ticket it was applied to`(_ adapter: WriteAdapter) async throws {
        let written = try await adapter.port().apply(
            .updateFields(WorkItemFields(title: "Something else")),
            to: 12,
            through: .stub(),
        )

        // The subject, and never the far end of an edge or a reply about something else — an
        // adopted ticket replaces the listed one by number.
        #expect(written.number == 12)
    }

    @Test(arguments: WriteAdapter.allCases)
    func `a write the adapter does not declare is refused`(_ adapter: WriteAdapter) async {
        let port = adapter.port()
        // An adapter with no gap has nothing for the claim to bite on, and that is itself worth
        // asserting: what the declaration exists to prevent is a gap found by a failed write.
        guard let missing = WorkItemWrite.allCases.first(where: { !port.surface.offers($0) })
        else {
            return #expect(port.surface.writes == Set(WorkItemWrite.allCases))
        }

        await #expect(throws: WorkItemWriteError.unavailable(missing)) {
            try await port.apply(missing.intent, to: 12, through: .stub())
        }
    }

    @Test(arguments: WriteAdapter.allCases)
    func `a state the provider cannot express is refused, never approximated`(
        _ adapter: WriteAdapter,
    ) async throws {
        // The alternative is writing the nearest state the provider DOES hold, which would leave a
        // ticket reading something nobody asked for and nothing able to tell that from the truth.
        let port = adapter.port()
        let unreachable = try #require(
            WorkItemCanonicalState.allCases.first { !port.surface.states.contains($0) },
        )

        await #expect(throws: WorkItemWriteError.inexpressible(unreachable)) {
            try await port.apply(.transitionTo(unreachable), to: 12, through: .stub())
        }
    }

    @Test(arguments: WriteAdapter.allCases)
    func `every declared write has an intent the adapter takes`(
        _ adapter: WriteAdapter,
    ) async throws {
        // A declaration is only worth reading if it is complete both ways: a control drawn off it
        // must not then be refused by the very adapter that offered it.
        let port = adapter.port()
        for write in port.surface.writes where write != .create {
            let landed = try await port.apply(write.intent, to: 12, through: .stub())
            #expect(landed.number == 12, "\(write) is declared but not taken")
        }
    }

    @Test(arguments: WriteAdapter.allCases)
    func `a created ticket comes back with the provider's own number`(
        _ adapter: WriteAdapter,
    ) async throws {
        let filed = try await adapter.empty().create(
            WorkItemDraft(title: "A new ticket"), through: .stub(),
        )

        // Argo stores the link and nothing else, so a create that did not answer with the number
        // would have produced a ticket Argo cannot address (`CONTEXT.md` L1 · Work Item).
        #expect(filed.number > 0)
    }

    @Test
    func `a transition the workflow has no edge for is refused, not routed around`() async throws {
        // Only a workflow-capable adapter can show this: on a bare tracker every expressible state
        // reaches every other, so its refusal is `inexpressible` and this one has no case. Argo
        // could reach `inReview` by way of `inProgress` and does not — a ticket that passed through
        // a state nobody asked for is a provider fact Argo authored.
        let port = WriteAdapter.workflow.port()

        await #expect(throws: WorkItemWriteError.illegalTransition(from: .todo, to: .done)) {
            try await port.apply(.transitionTo(.done), to: 12, through: .stub())
        }
    }
}

extension WorkItemWrite {
    /// The simplest intent that asks for this write, so a suite can walk a declaration without
    /// naming eleven payloads.
    var intent: WorkItemIntent {
        switch self {
        // `create` is not an intent — it has no ticket to be applied to — and every caller here
        // filters it out before asking.
        case .create, .updateFields: .updateFields(WorkItemFields(title: "Retitled"))
        case .transition: .transitionTo(.todo)
        case .blockedBy: .addBlockedBy(9)
        case .parent: .setParent(3)
        case .labels: .addLabel("engine")
        case .priority: .setPriority("High")
        case .closure: .reopen
        }
    }
}
