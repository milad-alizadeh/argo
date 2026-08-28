@testable import ArgoEngine
import Foundation
import Testing

/// What a landed write does to the room, and what a refused one does to the connection behind it
/// (#257, #260).
@Suite("Ticket write adoption")
struct TicketAdoptionTests {
    private static let project = "argo"

    private struct Writing {
        let writer: TicketWriter
        let items: TicketLedger
        let health: ConnectionHealthLedger
        let api: RecordedGitHub

        func fault() async -> ConnectionFault? {
            await health.health(of: ResolvedBinding.stub().binding, in: project).fault
        }
    }

    private static func writing(
        _ replies: [String: String], failing failure: Error? = nil,
    )
        -> Writing {
        let api = RecordedGitHub(replies: replies, failure: failure)
        let items = TicketLedger()
        let health = ConnectionHealthLedger()
        return Writing(
            writer: TicketWriter(
                port: GitHubTickets(transport: api), items: items, health: health,
            ),
            items: items,
            health: health,
            api: api,
        )
    }

    private static var target: PortReadTarget {
        PortReadTarget(binding: .stub(), projectID: project)
    }

    @Test
    func `a written ticket replaces the one the room was holding`() async throws {
        let listed = Ticket(number: 12, title: "Old title", status: "open", closure: .open)
        let writing = Self.writing([
            "/issues/12": IssueJSON(number: 12, title: "Port the Tickets room").json,
        ])
        await writing.items.record([listed], for: Self.project)

        _ = try await writing.writer.apply(
            .updateFields(TicketFields(title: "Port the Tickets room")),
            to: 12,
            on: Self.target,
        )

        // Without waiting for the next tick: a poll is a minute away, and a room that went on
        // drawing the old title for it would be showing something the provider has stopped saying.
        #expect(await writing.items.items(of: Self.project)
            .map(\.title) == ["Port the Tickets room"])
    }

    @Test
    func `a ticket that closed leaves the room rather than sitting in it`() async throws {
        let listed = Ticket(
            number: 12,
            title: "Port the Tickets room",
            status: "open",
            closure: .open,
        )
        let writing = Self.writing([
            "/issues/12": IssueJSON(number: 12, state: "closed", reason: "completed").json,
        ])
        await writing.items.record([listed], for: Self.project)

        _ = try await writing.writer.apply(.close(.resolved), to: 12, on: Self.target)

        // A listing holds the open tickets, so adopting a closed one would put something in the
        // room the very next poll takes out.
        #expect(await writing.items.items(of: Self.project).isEmpty)
    }

    @Test
    func `a filed ticket joins the room it was filed into`() async throws {
        let writing = Self.writing(["/issues": IssueJSON(number: 101, title: "New").json])

        _ = try await writing.writer.create(TicketDraft(title: "New"), on: Self.target)

        #expect(await writing.items.items(of: Self.project).map(\.number) == [101])
    }

    @Test
    func `the provider's own reason reaches the caller`() async throws {
        let writing = Self.writing(["/issues/12": """
        { "message": "Validation Failed",
          "errors": [{ "resource": "Issue", "field": "title", "code": "missing_field" }] }
        """])

        let refusal = await #expect(throws: TicketWriteError.self) {
            try await writing.writer.apply(
                .updateFields(TicketFields(title: "")), to: 12, on: Self.target,
            )
        }

        // Verbatim and field by field: Argo has no better wording for which field GitHub would not
        // take than GitHub's, and "the write failed" names nothing a reader could act on.
        #expect(refusal == .refused("Validation Failed: title missing_field"))
    }

    /// One write GitHub refuses, and everything that must be true afterwards.
    private static func refusedWrite() async -> Writing {
        let writing = Self.writing(["/issues/12": #"{ "message": "Validation Failed" }"#])
        _ = try? await writing.writer.apply(.transitionTo(.done), to: 12, on: Self.target)
        return writing
    }

    @Test
    func `a refused write is not sent again`() async {
        let writing = await Self.refusedWrite()

        // Re-sending a transition risks double-applying against a provider whose legality is
        // per-workflow — a second attempt is worse than the reason reaching the reader.
        #expect(await writing.api.writes().count == 1)
    }

    @Test
    func `a provider that answered no says nothing about the connection`() async {
        let writing = await Self.refusedWrite()

        // Filed as a fault it would leave the chip claiming something a reconnect cannot clear,
        // and the connection is demonstrably fine: the provider answered.
        #expect(await writing.fault() == nil)
    }

    @Test
    func `a 403 carrying GitHub's own words is a refusal, not a refused grant`() async {
        // GitHub declines a write the token may not make with the same 403 it retires a token
        // with. Read as the latter it marks every Binding on the Account down and sends the reader
        // through an OAuth round-trip that fixes nothing.
        let writing = Self.writing([:], failing: HTTPTransportError.unauthorized(
            code: 403, reason: "Resource not accessible by personal access token",
        ))

        let refusal = await #expect(throws: TicketWriteError.self) {
            try await writing.writer.apply(.reopen, to: 12, on: Self.target)
        }

        #expect(refusal == .refused("Resource not accessible by personal access token"))
        #expect(await writing.fault() == nil)
    }

    @Test
    func `a number the provider has nothing behind is a refusal, not a fault`() async {
        // An edge write reads the far ticket to address it, and a 404 there is the caller naming a
        // ticket that is not there — never the connection.
        let writing = Self.writing([
            "/issues/12": IssueJSON(number: 12).json,
            "/issues/99": #"{ "message": "Not Found" }"#,
        ])

        let refusal = await #expect(throws: TicketWriteError.self) {
            try await writing.writer.apply(.addBlockedBy(99), to: 12, on: Self.target)
        }

        #expect(refusal == .refused("Not Found"))
        #expect(await writing.fault() == nil)
    }

    @Test
    func `a write that never reached the provider is recorded as a fault`() async {
        let api = RecordedGitHub(replies: [:], failure: URLError(.notConnectedToInternet))
        let health = ConnectionHealthLedger()
        let writer = TicketWriter(
            port: GitHubTickets(transport: api), items: TicketLedger(), health: health,
        )

        _ = try? await writer.apply(.reopen, to: 12, on: Self.target)

        #expect(await health.health(of: ResolvedBinding.stub().binding, in: Self.project)
            .fault == .read(.offline))
    }

    @Test
    func `a landed write clears the fault the last failure left`() async throws {
        let writing = Self.writing(["/issues/12": IssueJSON(number: 12).json])
        await writing.health.failed(
            ResolvedBinding.stub().binding, in: Self.project, cause: .unreachable,
        )

        _ = try await writing.writer.apply(.reopen, to: 12, on: Self.target)

        // A write that went through is proof the connection works, on the same terms a read is.
        #expect(await writing.fault() == nil)
    }
}
