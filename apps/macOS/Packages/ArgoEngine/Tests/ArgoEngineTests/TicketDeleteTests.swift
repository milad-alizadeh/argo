@testable import ArgoEngine
import Testing

/// What each adapter actually sends to remove a ticket (#1247), and what it does with a provider
/// that says no.
@Suite("Deleting a ticket")
struct TicketDeleteTests {
    /// GitHub has no REST delete, so this goes to GraphQL — and names the issue by its GLOBAL node
    /// id, which is neither the number a human reads nor the database id every edge write uses.
    @Test
    func `GitHub deletes through GraphQL, naming the issue's node id`() async throws {
        let transport = RecordedGitHub(replies: [
            "/issues/12": IssueJSON(number: 12).json,
            "/graphql": RecordedGitHub.deleted,
        ])

        try await GitHubTickets(transport: transport).delete(12, through: .stub())

        let sent = try #require(await transport.writes().first)
        #expect(sent.path == "/graphql")
        #expect(sent.field("query")?.contains("deleteIssue") == true)
        #expect(sent.field("variables")?.contains(IssueJSON.node(of: 12)) == true)
        #expect(sent.field("variables")?.contains("\(IssueJSON.identifier(of: 12))") == false)
    }

    /// GraphQL refuses with a `200` carrying an `errors` array, which the REST refusal read cannot
    /// see. Unread, a delete the API declined would report as one that landed.
    @Test
    func `a GraphQL refusal is the caller's refusal, not a write that landed`() async {
        let transport = RecordedGitHub(replies: [
            "/issues/12": IssueJSON(number: 12).json,
            "/graphql": #"{ "errors": [ { "message": "Must have admin access" } ] }"#,
        ])

        await #expect(throws: TicketWriteError.refused("Must have admin access")) {
            try await GitHubTickets(transport: transport).delete(12, through: .stub())
        }
    }

    /// Linear deletes by its own issue id, through the mutation it names.
    @Test
    func `Linear deletes by the issue id it addresses`() async throws {
        let transport = LinearFixture.holding([LinearIssueJSON(number: 12)])

        try await LinearTickets(transport: transport).delete(12, through: .linear())

        #expect(await transport.documents().contains { $0.contains("issueDelete") })
    }

    /// The listing the room draws from loses the row only once the PROVIDER has said it is gone —
    /// a row taken off the list on the press is a false DIRECT about somebody else's record.
    @Test
    func `the listing loses the ticket the provider removed`() async {
        let ledger = TicketLedger()
        await ledger.record(
            [
                Ticket(number: 12, title: "Gone", status: "Todo", closure: .open),
                Ticket(number: 13, title: "Kept", status: "Todo", closure: .open),
            ],
            for: "argo",
        )

        await ledger.forget(12, for: "argo")

        #expect(await ledger.items(of: "argo").map(\.number) == [13])
    }
}
