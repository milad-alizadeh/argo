@testable import ArgoEngine
import Foundation
import Testing

/// What a Linear write answers with, and what it does when Linear says no.
///
/// GraphQL, so a refusal is a 200 carrying `errors` and the SHAPE is what says so — the one place
/// this adapter's failure reading differs from GitHub's in kind rather than in wording.
@Suite("Linear Ticket write refusals")
struct LinearWriteRefusalTests {
    private static func team(_ replies: [String: String] = [:]) -> RecordedLinear {
        RecordedLinear(
            holding: [LinearIssueJSON(number: 12, title: "Port the Work room", labels: ["engine"])],
            replies: LinearFixture.team.merging(replies) { $1 },
        )
    }

    @Test
    func `a write answers with the ticket as Linear now holds it, edges and all`() async throws {
        let written = try await LinearTickets(transport: Self.team()).apply(
            .updateFields(TicketFields(title: "Something else")), to: 12, through: .linear(),
        )

        // Read back through the listing's own fields rather than adopted from the mutation's
        // reply, which carries no relations — adopting that would blank a ticket's edges on
        // every write.
        #expect(written.number == 12)
        #expect(written.labels == [TicketLabel(name: "engine")])
        #expect(written.blockedBy == [])
    }

    @Test
    func `Linear's own sentence travels verbatim`() async {
        let refusal = #"{ "errors": [{ "message": "Field is not writable." }], "data": null }"#

        await #expect(throws: TicketWriteError.refused("Field is not writable.")) {
            _ = try await LinearTickets(transport: Self.team(["mutation IssueUpdate": refusal]))
                .apply(.updateFields(TicketFields(title: "x")), to: 12, through: .linear())
        }
    }

    @Test
    func `a mutation that answered false is a write that did not land`() async {
        let unapplied = #"{ "data": { "result": { "success": false } } }"#

        await #expect(throws: TicketWriteError.refused("Linear did not apply the change.")) {
            _ = try await LinearTickets(transport: Self.team(["mutation IssueUpdate": unapplied]))
                .apply(.updateFields(TicketFields(title: "x")), to: 12, through: .linear())
        }
    }

    @Test
    func `a number the team does not hold is refused rather than written blind`() async {
        let refusal = TicketWriteError.refused("Linear holds no issue 99 in this team.")

        await #expect(throws: refusal) {
            _ = try await LinearTickets(transport: Self.team()).apply(
                .updateFields(TicketFields(title: "x")), to: 99, through: .linear(),
            )
        }
    }

    @Test
    func `a label the workspace has not got is refused, never created to satisfy the write`(
    ) async {
        let none = #"{ "data": { "issueLabels": { "nodes": [] } } }"#

        await #expect(
            throws: TicketWriteError.refused("This workspace has no label called \"nope\"."),
        ) {
            _ = try await LinearTickets(transport: Self.team(["query Label": none]))
                .apply(.addLabel("nope"), to: 12, through: .linear())
        }
    }

    @Test
    func `a team with no cancelled column genuinely cannot express closed`() async {
        let narrow = """
        { "data": { "team": { "states": { "nodes": [
          { "id": "s-todo", "name": "Todo", "type": "unstarted", "position": 0 }
        ] } } } }
        """

        await #expect(throws: TicketWriteError.inexpressible(.closed)) {
            _ = try await LinearTickets(transport: Self.team(["query TeamStates": narrow]))
                .apply(.close(.ruledOut), to: 12, through: .linear())
        }
    }

    @Test
    func `a write that never reached Linear is the connection's failure, not a refusal`() async {
        let api = RecordedLinear(
            holding: [LinearIssueJSON(number: 12)],
            replies: LinearFixture.team,
            failure: HTTPTransportError.unauthorized(code: 401, reason: nil),
        )

        await #expect(throws: TicketWriteError.unreachable(.grantRefused)) {
            _ = try await LinearTickets(transport: api).apply(
                .updateFields(TicketFields(title: "x")), to: 12, through: .linear(),
            )
        }
    }

    @Test
    func `a create names its parent on the create itself, so no window has an orphan in it`(
    ) async throws {
        let api = RecordedLinear(
            holding: [
                LinearIssueJSON(number: 3),
                LinearIssueJSON(number: 101, title: "A new ticket"),
            ],
            replies: LinearFixture.team,
        )

        let filed = try await LinearTickets(transport: api).create(
            TicketDraft(title: "A new ticket", body: "Why", parent: 3), through: .linear(),
        )

        #expect(filed.number == 101)
        #expect(await api.variables(of: "mutation IssueCreate")?["input"] == .object([
            "teamId": .string("team-eng"),
            "title": .string("A new ticket"),
            "description": .string("Why"),
            "parentId": .string("issue-3"),
        ]))
    }
}
