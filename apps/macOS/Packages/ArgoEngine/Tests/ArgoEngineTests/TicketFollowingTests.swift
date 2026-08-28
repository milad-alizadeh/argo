@testable import ArgoEngine
import Foundation
import Testing

/// What a ticket read by the number a link named does to the listing the room draws from (#895).
///
/// A poll's listing is open-only and is replaced whole on every tick. A followed ticket is neither:
/// it is closed, and it is not the poll's to retire.
@Suite("Following a ticket by number")
struct TicketFollowingTests {
    private static let project = "argo"

    private static func closed(_ number: Int) -> Ticket {
        Ticket(number: number, title: "App shell", status: "closed", closure: .resolved)
    }

    @Test
    func `a followed ticket joins the listing the room reads`() async {
        let items = TicketLedger()
        await items.record([Ticket(
            number: 607, title: "The Tickets room", status: "open", closure: .open,
        )], for: Self.project)

        await items.follow(Self.closed(264), for: Self.project)

        #expect(await items.items(of: Self.project).map(\.number) == [607, 264])
    }

    /// The tick that follows must not take it away again: the poll replaces its listing whole, and
    /// a closed ticket was never in that listing to be replaced.
    @Test
    func `the next poll does not retire a ticket the reader followed`() async {
        let items = TicketLedger()
        await items.follow(Self.closed(264), for: Self.project)

        await items.record([Ticket(
            number: 607, title: "The Tickets room", status: "open", closure: .open,
        )], for: Self.project)

        #expect(await items.items(of: Self.project).map(\.number) == [607, 264])
    }

    /// One Project's followed ticket is not another's, on the same terms the listings are.
    @Test
    func `a followed ticket belongs to the Project it was read for`() async {
        let items = TicketLedger()

        await items.follow(Self.closed(264), for: Self.project)

        #expect(await items.items(of: "other").isEmpty)
    }

    /// The listing is the fresher of the two — it was read this tick, and the follow may be an
    /// hour old — so a number in both is the poll's.
    @Test
    func `a followed ticket the poll has since listed is counted once`() async {
        let items = TicketLedger()
        await items.follow(Self.closed(264), for: Self.project)

        await items.record(
            [Ticket(number: 264, title: "Reopened", status: "open", closure: .open)],
            for: Self.project,
        )

        #expect(await items.items(of: Self.project).map(\.title) == ["Reopened"])
    }

    // MARK: - End to end, through the Project's own Binding

    private struct Bound {
        let follower: TicketFollower
        let items: TicketLedger
        let health: ConnectionHealthLedger
        let projectID: String

        func fault() async -> ConnectionFault? {
            await health.health(of: .gitHub(), in: projectID).fault
        }
    }

    private static func bound(_ fixture: BindingFixture, _ api: StubProviderAPI) async throws
        -> Bound {
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(), to: projectID)
        let items = TicketLedger()
        let health = ConnectionHealthLedger()
        return Bound(
            follower: TicketFollower(
                bindings: fixture.bindings(),
                items: items,
                health: health,
                reads: ProviderTickets(transport: api),
            ),
            items: items,
            health: health,
            projectID: projectID,
        )
    }

    @Test
    func `a followed number is read through the Project's Binding and kept`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = StubProviderAPI(
            body: IssueJSON(number: 264, state: "closed", reason: "completed").json,
        )
        let bound = try await Self.bound(fixture, api)

        await bound.follower.follow(264, forProject: bound.projectID)

        #expect(await bound.items.items(of: bound.projectID).map(\.number) == [264])
        #expect(await api.urls()
            .contains { $0.hasSuffix("/repos/milad-alizadeh/argo/issues/264") })
    }

    /// The listing is the poll's, and a number already in it is not the follow's to re-read: the
    /// bound this ticket keeps is one request per ticket a reader followed, and none for the rest.
    @Test
    func `a number the listing already holds costs no request`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = StubProviderAPI(body: IssueJSON(number: 607).json)
        let bound = try await Self.bound(fixture, api)
        await bound.items.record(
            [Ticket(number: 607, title: "The Tickets room", status: "open", closure: .open)],
            for: bound.projectID,
        )

        await bound.follower.follow(607, forProject: bound.projectID)

        #expect(await api.urls().isEmpty)
    }

    /// A number the provider has nothing behind leaves the listing exactly as it was — a room that
    /// held a stand-in for it would be drawing a ticket nobody confirmed exists.
    @Test
    func `a number the provider answers nothing for lands nothing`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = StubProviderAPI(body: #"{ "message": "Not Found" }"#)
        let bound = try await Self.bound(fixture, api)

        await bound.follower.follow(9001, forProject: bound.projectID)

        #expect(await bound.items.items(of: bound.projectID).isEmpty)
    }

    /// The two halves of the port's absence, told apart where it matters. A number the provider
    /// answered nothing for says something about the NUMBER, so the chip behind the Binding stays
    /// as it was.
    @Test
    func `a number the provider answers nothing for leaves the connection alone`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = StubProviderAPI(body: #"{ "message": "Not Found" }"#)
        let bound = try await Self.bound(fixture, api)

        await bound.follower.follow(9001, forProject: bound.projectID)

        #expect(await bound.fault() == nil)
    }

    /// The other half: a read that established nothing IS evidence about the Binding, and a chip
    /// that stayed quiet through it would be claiming a connection nobody has checked since.
    @Test
    func `a follow that could not be read is recorded against the Binding`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = StubProviderAPI(body: "{}", failure: .unauthorized(code: 401, reason: nil))
        let bound = try await Self.bound(fixture, api)

        await bound.follower.follow(264, forProject: bound.projectID)

        #expect(await bound.fault() != nil)
    }
}
