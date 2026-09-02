@testable import ArgoEngine
import Testing

/// The closed read end to end, through the Project's own Binding — `TicketFollower`'s sibling, and
/// the only route to the closed listing there is (#1075).
///
/// Its ledger half is `ClosedTicketReadingTests`. This half is what opening the view and pressing
/// `Load more` actually cost, counted in requests.
@Suite("Reading the closed listing through a Binding")
struct ClosedTicketReaderTests {
    private struct Bound {
        let reader: ClosedTicketReader
        let items: TicketLedger
        let health: ConnectionHealthLedger
        let projectID: String

        func fault() async -> ConnectionFault? {
            await health.health(of: .gitHub(), in: projectID).fault
        }
    }

    private static func bound(_ fixture: BindingFixture, _ api: RecordedGitHub) async throws
        -> Bound {
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(), to: projectID)
        let items = TicketLedger()
        let health = ConnectionHealthLedger()
        return Bound(
            reader: ClosedTicketReader(
                bindings: fixture.bindings(),
                ledgers: TicketPoll.Ledgers(health: health, items: items),
                reads: ProviderTickets(transport: api),
            ),
            items: items,
            health: health,
            projectID: projectID,
        )
    }

    /// A full first page and a short second, so a suite can extend and see which one it landed on.
    private static func paged() -> RecordedGitHub {
        RecordedGitHub(replies: [
            RecordedGitHub.closedIssues(page: 1): IssueJSON.list(
                (0 ..< ClosedTicketPage.size).map {
                    IssueJSON(number: 500 - $0, state: "closed", reason: "completed")
                },
            ),
            RecordedGitHub.closedIssues(page: 2): IssueJSON.list([
                IssueJSON(number: 400, state: "closed", reason: "not_planned"),
            ]),
        ])
    }

    @Test
    func `opening the view reads the first page through the Project's Binding`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let bound = try await Self.bound(fixture, Self.paged())

        await bound.reader.open(forProject: bound.projectID)

        let listing = await bound.items.closedListing(of: bound.projectID)
        #expect(listing?.items.count == ClosedTicketPage.size)
        #expect(listing?.hasMore == true)
    }

    @Test
    func `the next page resumes at the cursor and is appended to the one in hand`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = Self.paged()
        let bound = try await Self.bound(fixture, api)
        await bound.reader.open(forProject: bound.projectID)

        await bound.reader.extend(forProject: bound.projectID)

        let listing = await bound.items.closedListing(of: bound.projectID)
        #expect(listing?.items.count == ClosedTicketPage.size + 1)
        #expect(listing?.items.last?.number == 400)
        #expect(listing?.hasMore == false)
        #expect(await api.urls().count == 2)
    }

    /// A `Load more` that read the first page again would answer a different question than the row
    /// it sits under asks — and the row is not drawn at all once the provider served its last page.
    @Test
    func `extending past the last page costs no request`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = Self.paged()
        let bound = try await Self.bound(fixture, api)
        await bound.reader.open(forProject: bound.projectID)
        await bound.reader.extend(forProject: bound.projectID)

        await bound.reader.extend(forProject: bound.projectID)

        #expect(await api.urls().count == 2)
    }

    @Test
    func `extending before the view was opened costs no request`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = Self.paged()
        let bound = try await Self.bound(fixture, api)

        await bound.reader.extend(forProject: bound.projectID)

        #expect(await api.urls().isEmpty)
    }

    /// A read that established nothing IS evidence about the Binding, on `TicketFollower`'s terms.
    @Test
    func `a closed read that could not be made is recorded against the Binding`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = RecordedGitHub(replies: [:], failure: HTTPTransportError.unauthorized(
            code: 401, reason: nil,
        ))
        let bound = try await Self.bound(fixture, api)

        await bound.reader.open(forProject: bound.projectID)

        #expect(await bound.fault() != nil)
    }

    /// A failed page must not blank a view that was full a second ago — the poll's own rule, and
    /// the reason the listing is left where it was rather than replaced with nothing.
    @Test
    func `a failed read leaves the listing where it was`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let bound = try await Self.bound(fixture, RecordedGitHub(
            replies: [:], failure: ProviderFetchError.unreachable,
        ))
        await bound.items.openClosed(
            ClosedTicketPage(items: [Ticket(
                number: 264, title: "App shell", status: "closed", closure: .resolved,
            )]),
            for: bound.projectID,
        )

        await bound.reader.open(forProject: bound.projectID)

        #expect(await bound.items.closedListing(of: bound.projectID)?.items.map(\.number) == [264])
    }
}
