@testable import ArgoEngine
import Testing

/// The Ticket adapters the by-number read runs against — both shipped ports (#371), held to one
/// answer for one question.
enum ReadAdapter: String, CaseIterable, Sendable {
    case gitHub
    case linear

    /// The scope each adapter's Binding holds: `owner/repo` for one, a team id for the other.
    var binding: ResolvedBinding {
        switch self {
        case .gitHub: .stub()
        case .linear: .linear()
        }
    }

    /// A port holding ticket 264, closed and out of every listing.
    func port() -> any TicketPort {
        switch self {
        case .gitHub:
            GitHubTickets(transport: RecordedGitHub(replies: [
                "/issues/264": IssueJSON(
                    number: 264, title: "App shell", state: "closed", reason: "completed",
                ).json,
            ]))
        case .linear:
            LinearTickets(transport: LinearFixture.holding([
                LinearIssueJSON(
                    number: 264, title: "App shell", state: "Done", category: "completed",
                ),
            ]))
        }
    }

    /// A port holding one resolved and one ruled-out ticket, in that order, on whichever path each
    /// provider serves its CLOSED listing through (#1075).
    func closedPort() -> any TicketPort {
        switch self {
        case .gitHub:
            GitHubTickets(transport: RecordedGitHub(replies: [
                RecordedGitHub.closedIssues(page: 1): IssueJSON.list([
                    IssueJSON(number: 264, state: "closed", reason: "completed"),
                    IssueJSON(number: 265, state: "closed", reason: "not_planned"),
                ]),
            ]))
        case .linear:
            LinearTickets(transport: RecordedLinear(replies: [
                "query TeamClosedIssues": LinearIssueJSON.page([
                    LinearIssueJSON(number: 264, state: "Done", category: "completed"),
                    LinearIssueJSON(number: 265, state: "Canceled", category: "canceled"),
                ]),
            ]))
        }
    }

    /// A port the number names nothing on, answering so rather than failing to answer.
    func empty() -> any TicketPort {
        switch self {
        case .gitHub:
            GitHubTickets(transport: RecordedGitHub(replies: [
                "/issues": #"{ "message": "Not Found" }"#,
            ]))
        case .linear:
            LinearTickets(transport: LinearFixture.holding([]))
        }
    }
}

@Suite("Ticket read conformance")
struct TicketReadConformanceTests {
    /// The whole point of the port method: a closed ticket is not in any listing, so the only way
    /// to it is by the number a link named (#895).
    @Test(arguments: ReadAdapter.allCases)
    func `a closed ticket no listing holds is read by its number`(
        _ adapter: ReadAdapter,
    ) async throws {
        let binding = adapter.binding
        let read = try await adapter.port().ticket(
            number: 264, in: binding.binding.scope, grant: binding.grant,
        )

        let ticket = try #require(read)
        #expect(ticket.number == 264)
        #expect(ticket.title == "App shell")
        #expect(ticket.closure == .resolved)
    }

    /// A provider that answered and has nothing behind the number is ABSENT, which is a reading —
    /// distinct from a read that established nothing, which throws (`TicketTitleReading`).
    @Test(arguments: ReadAdapter.allCases)
    func `a number the provider has nothing behind is absent, not a failure`(
        _ adapter: ReadAdapter,
    ) async throws {
        let binding = adapter.binding
        let read = try await adapter.empty().ticket(
            number: 9001, in: binding.binding.scope, grant: binding.grant,
        )

        #expect(read == nil)
    }

    /// The routed seam the poll's own side holds, where the port's takes a scope and a grant that
    /// do not say which provider issued them.
    @Test
    func `a followed number is read through the Binding's own provider`() async throws {
        let reading = ProviderTickets(transport: RecordedGitHub(replies: [
            "/issues/264": IssueJSON(
                number: 264, title: "App shell", state: "closed", reason: "completed",
            ).json,
        ]))

        let read = try await reading.ticket(number: 264, through: .stub())

        #expect(read?.closure == .resolved)
    }
}
