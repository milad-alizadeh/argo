@testable import ArgoEngine
import Foundation
import Testing

/// What each canonical intent actually puts on the wire at Linear — the half of the port a
/// conformance suite cannot see, because it asks whether a write landed and not what was sent.
@Suite("Linear Work Item writes")
struct LinearWriteTests {
    /// Ticket 12, with 9 and 3 for the far ends an edge intent names.
    private static func team() -> RecordedLinear {
        LinearFixture.holding([
            LinearIssueJSON(number: 12, title: "Port the Work room"),
            LinearIssueJSON(number: 9),
            LinearIssueJSON(number: 3),
        ])
    }

    private static func apply(
        _ intent: WorkItemIntent, to number: Int = 12,
    ) async throws
        -> RecordedLinear {
        let api = team()
        _ = try await LinearWorkItems(transport: api).apply(
            intent, to: number, through: .linear(),
        )
        return api
    }

    @Test
    func `a subject is addressed by Linear's UUID and never by the number Argo holds`(
    ) async throws {
        let api = try await Self.apply(.updateFields(WorkItemFields(title: "Something else")))

        #expect(await api.variables(of: "mutation IssueUpdate")?["id"] == .string("issue-12"))
    }

    @Test
    func `an edit names only the halves it changes`() async throws {
        // `nil` is "leave it alone", so sending it as null would clear a body nobody asked to.
        let api = try await Self.apply(.updateFields(WorkItemFields(title: "Something else")))

        #expect(
            await api.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["title": .string("Something else")]),
        )
    }

    @Test
    func `a transition picks the first column of the category, in the team's own order`(
    ) async throws {
        // The fixture's team has `Backlog` (0) and `Todo` (1), both `todo` columns.
        let api = try await Self.apply(.transitionTo(.todo))

        #expect(
            await api.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["stateId": .string("s-backlog")]),
        )
    }

    struct ClosingCase: Sendable {
        let reason: WorkItemCloseReason
        let column: String
    }

    @Test(arguments: [
        ClosingCase(reason: .resolved, column: "s-done"),
        ClosingCase(reason: .ruledOut, column: "s-cancelled"),
    ])
    func `a closure survives the write, because Linear has a column for each reason`(
        _ testCase: ClosingCase,
    ) async throws {
        let api = try await Self.apply(.close(testCase.reason))

        #expect(
            await api.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["stateId": .string(testCase.column)]),
        )
    }

    @Test
    func `a state Linear has no category for is refused, never approximated`() async {
        // Linear expresses `inReview` only as a column a team NAMED that way, which is a
        // `started` state — deriving the canonical one from prose would be a false DIRECT.
        await #expect(throws: WorkItemWriteError.inexpressible(.inReview)) {
            _ = try await LinearWorkItems(transport: Self.team()).apply(
                .transitionTo(.inReview), to: 12, through: .linear(),
            )
        }
    }

    @Test
    func `a priority word becomes the rung Linear holds it at`() async throws {
        let api = try await Self.apply(.setPriority("High"))

        #expect(
            await api.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["priority": .int(2)]),
        )
    }

    @Test
    func `clearing a priority is the rung Linear spells as no priority`() async throws {
        let api = try await Self.apply(.setPriority(nil))

        #expect(
            await api.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["priority": .int(0)]),
        )
    }

    @Test
    func `a priority word Linear has no rung for is refused before the wire`() async {
        // Rounding to the nearest rung would file a ticket at an urgency nobody chose.
        let api = Self.team()
        await #expect(throws: (any Error).self) {
            _ = try await LinearWorkItems(transport: api).apply(
                .setPriority("Blocker"), to: 12, through: .linear(),
            )
        }
        #expect(await api.documents().allSatisfy { !$0.contains("mutation") })
    }

    @Test
    func `a blocking edge is filed from the blocker, which is the way Linear reads one`(
    ) async throws {
        let api = try await Self.apply(.addBlockedBy(9))

        #expect(
            await api.variables(of: "mutation RelationCreate")?["input"] == .object([
                "issueId": .string("issue-9"),
                "relatedIssueId": .string("issue-12"),
                "type": .string("blocks"),
            ]),
        )
    }

    @Test
    func `clearing a blocking edge names the relation by its own id`() async throws {
        let api = try await Self.apply(.removeBlockedBy(9))

        #expect(await api.variables(of: "mutation RelationDelete")?["id"] == .string("rel-9"))
    }

    @Test
    func `a parent is set by id and cleared without naming one`() async throws {
        let parented = try await Self.apply(.setParent(3))
        let orphaned = try await Self.apply(.removeParent(3))

        #expect(
            await parented.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["parentId": .string("issue-3")]),
        )
        #expect(
            await orphaned.variables(of: "mutation IssueUpdate")?["input"]
                == .object(["parentId": .null]),
        )
    }

    @Test
    func `a label is resolved to its id before it is added`() async throws {
        let api = try await Self.apply(.addLabel("engine"))

        #expect(await api.variables(of: "query Label")?["name"] == .string("engine"))
        #expect(await api.variables(of: "mutation AddLabel")?["label"] == .string("label-engine"))
    }
}
