@testable import ArgoEngine
import Foundation
import Testing

/// The closed read end to end, through the Project's own Binding — `TicketFollower`'s sibling, and
/// the only route to the closed listing there is (#1075).
///
/// Its ledger half is `ClosedTicketReadingTests`. This half is what opening the view and pressing
/// `Load more` actually cost, counted in requests.
@Suite("Reading the closed listing through a Binding")
struct ClosedTicketReaderTests {
    @Test
    func `opening the view reads the first page through the Project's Binding`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let bound = try await closedReader(fixture, paged())

        await bound.reader.open(forProject: bound.projectID)

        let listing = await bound.items.closedListing(of: bound.projectID)
        #expect(listing?.items.count == ClosedTicketPage.size)
        #expect(listing?.hasMore == true)
    }

    @Test
    func `the next page is appended to the one already in hand`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let bound = try await closedReader(fixture, paged())
        await bound.reader.open(forProject: bound.projectID)

        await bound.reader.extend(forProject: bound.projectID)

        let listing = await bound.items.closedListing(of: bound.projectID)
        #expect(listing?.items.count == ClosedTicketPage.size + 1)
        #expect(listing?.items.last?.number == 400)
    }

    /// It resumes rather than re-reading: two requests for two pages, and the second was asked for
    /// at the cursor the first came back with.
    @Test
    func `the next page is asked for at the cursor the first served`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = paged()
        let bound = try await closedReader(fixture, api)
        await bound.reader.open(forProject: bound.projectID)

        await bound.reader.extend(forProject: bound.projectID)

        #expect(await api.urls().count == 2)
        #expect(await api.urls().last?.contains("page=2") == true)
    }

    /// A `Load more` that read the first page again would answer a different question than the row
    /// it sits under asks — and the row is not drawn at all once the provider served its last page.
    @Test
    func `extending past the last page costs no request`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = paged()
        let bound = try await closedReader(fixture, api)
        await bound.reader.open(forProject: bound.projectID)
        await bound.reader.extend(forProject: bound.projectID)

        await bound.reader.extend(forProject: bound.projectID)

        #expect(await api.urls().count == 2)
    }

    @Test
    func `extending before the view was opened costs no request`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = paged()
        let bound = try await closedReader(fixture, api)

        await bound.reader.extend(forProject: bound.projectID)

        #expect(await api.urls().isEmpty)
    }

    /// A failed page must not blank a view that was full a second ago — the poll's own rule, and
    /// the reason the listing is left where it was rather than replaced with nothing.
    @Test
    func `a failed read leaves the listing where it was`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let bound = try await closedReader(fixture, RecordedGitHub(
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

/// What a closed page says about the connection it was read through, both ways round (#1699).
///
/// Every reader files under one key — the Binding plus the Account — so whichever of them read
/// last is the one the chip is answering from.
@Suite("What a closed page records about the connection")
struct ClosedTicketReaderHealthTests {
    /// A read that established nothing IS evidence about the Binding, on `TicketFollower`'s terms.
    @Test
    func `a closed read that could not be made is recorded against the Binding`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = RecordedGitHub(replies: [:], failure: HTTPTransportError.unauthorized(
            code: 401, reason: nil,
        ))
        let bound = try await closedReader(fixture, api)

        await bound.reader.open(forProject: bound.projectID)

        #expect(await bound.fault() != nil)
    }

    /// A second `Load more` that landed used to leave the chip contradicting the page it served,
    /// for as long as the minute the poll waits.
    @Test
    func `a closed page that landed clears the fault a failed one set`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let bound = try await closedReader(fixture, RecordedGitHub(
            replies: [:], failure: ProviderFetchError.unreachable,
        ))
        await bound.reader.open(forProject: bound.projectID)
        try #require(await bound.fault() != nil)

        await bound.anotherReader(over: paged()).open(forProject: bound.projectID)

        #expect(await bound.fault() == nil)
    }

    /// The age the chip counts from is the moment the page landed, so a landed page dates itself.
    @Test
    func `a closed page that landed is dated at the moment it did`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let landed = Date(timeIntervalSince1970: 1_700_000_000)
        let bound = try await closedReader(fixture, paged(), now: { landed })

        await bound.reader.open(forProject: bound.projectID)

        #expect(await bound.lastSuccess() == landed)
    }
}

// MARK: - One reader on a throwaway machine, shared by both suites

/// A full first page and a short second, so a suite can extend and see which one it landed on.
private func paged() -> RecordedGitHub {
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

private func closedReader(
    _ fixture: BindingFixture,
    _ api: RecordedGitHub,
    now: @escaping @Sendable () -> Date = Date.init,
) async throws
    -> BoundClosedReader {
    let projectID = try await fixture.project("argo")
    try await fixture.accountStore().authorizeGitHub(id: "1")
    try await fixture.bindings().bind(.gitHub(), to: projectID)
    let items = TicketLedger()
    let health = ConnectionHealthLedger()
    return BoundClosedReader(
        reader: ClosedTicketReader(
            bindings: fixture.bindings(),
            ledgers: TicketPoll.Ledgers(health: health, items: items),
            reads: ProviderTickets(transport: api),
            now: now,
        ),
        bindings: fixture.bindings(),
        items: items,
        health: health,
        projectID: projectID,
        now: now,
    )
}

private struct BoundClosedReader {
    let reader: ClosedTicketReader
    let bindings: ProjectBindings
    let items: TicketLedger
    let health: ConnectionHealthLedger
    let projectID: String
    let now: @Sendable () -> Date

    func fault() async -> ConnectionFault? {
        await health.health(of: .gitHub(), in: projectID).fault
    }

    func lastSuccess() async -> Date? {
        await health.health(of: .gitHub(), in: projectID).lastSuccess
    }

    /// A second reader over the same two ledgers and the same clock. One recorded host either
    /// fails for the whole of its life or answers for it, so a failed read followed by a landed
    /// one takes two.
    func anotherReader(over api: RecordedGitHub) -> ClosedTicketReader {
        ClosedTicketReader(
            bindings: bindings,
            ledgers: TicketPoll.Ledgers(health: health, items: items),
            reads: ProviderTickets(transport: api),
            now: now,
        )
    }
}
